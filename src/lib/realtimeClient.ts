// src/lib/realtimeClient.ts
let pc: RTCPeerConnection | null = null;
let micStream: MediaStream | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let dataChannel: RTCDataChannel | null = null;

type StartResult = {
  ok: boolean;
  error?: string;
};

async function getSessionFromServer(): Promise<{ client_secret: any; instructions: string; voice?: string }> {
  const r = await fetch('/api/startChat', { method: 'POST' });

  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await r.json() : await r.text();

  if (!r.ok) {
    const msg = isJson
      ? (body.error || body.details || JSON.stringify(body))
      : body;
    throw new Error(msg);
  }
  return body as { client_secret: any; instructions: string; voice?: string };
}

export async function startRealtimeCall(): Promise<StartResult> {
  try {
    // 1) בקשת client_secret + instructions מהשרת (קריאה חד-פעמית לגוף)
    const { client_secret, instructions, voice } = await getSessionFromServer();
    const secret: string = client_secret?.value ?? client_secret; // תמיכה בשתי הצורות

    // 2) אלמנט אודיו לניגון ה-remote
    if (!remoteAudioEl) {
      remoteAudioEl = document.getElementById('remote-audio') as HTMLAudioElement | null;
      if (!remoteAudioEl) {
        remoteAudioEl = document.createElement('audio');
        remoteAudioEl.id = 'remote-audio';
        remoteAudioEl.autoplay = true;
        remoteAudioEl.playsInline = true;
        document.body.appendChild(remoteAudioEl);
      }
    }

    // 3) מיקרופון
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 4) RTCPeerConnection
    pc = new RTCPeerConnection();
    // נכין ערוץ דאטה לאירועים (oai)
    dataChannel = pc.createDataChannel('oai-events');

    // שידור מיקרופון
    micStream.getTracks().forEach((t) => pc!.addTrack(t, micStream!));
    // קבלת אודיו מרוחק
    pc.addEventListener('track', (ev) => {
      const [remoteStream] = ev.streams;
      if (remoteAudioEl) remoteAudioEl.srcObject = remoteStream;
    });

    // 5) SDP Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 6) החלפת SDP עם OpenAI Realtime בעזרת ה-client_secret (JWT)
    const sdpResp = await fetch(
      'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp!,
      }
    );
    const answerSdp = await sdpResp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    // 7) ברגע שה-DataChannel פתוח: session.update ואז response.create
    dataChannel.addEventListener('open', () => {
      // מזריקים הנחיות וקול
      dataChannel!.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            instructions,             // מהשרת (DB)
            voice: voice ?? 'alloy',
          },
        })
      );

      // תגובה ראשונית שתפעיל את פתיחת השיחה
      dataChannel!.send(
        JSON.stringify({
          type: 'response.create',
          response: {},
        })
      );
    });

    return { ok: true };
  } catch (err: any) {
    console.error('startRealtimeCall error:', err);
    return { ok: false, error: err?.message ?? String(err) };
  }
}

export function stopRealtimeCall(): void {
  try {
    dataChannel?.close();
    dataChannel = null;

    pc?.getSenders().forEach((s) => s.track && s.track.stop());
    pc?.getReceivers().forEach((r) => r.track && r.track.stop());
    pc?.close();
    pc = null;

    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;

    if (remoteAudioEl) {
      remoteAudioEl.srcObject = null;
    }
  } catch (e) {
    console.warn('stopRealtimeCall error:', e);
  }
}
