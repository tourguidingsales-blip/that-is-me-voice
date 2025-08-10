// src/lib/realtimeClient.ts
let pc: RTCPeerConnection | null = null;
let micStream: MediaStream | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let dataChannel: RTCDataChannel | null = null;

type StartResult = { ok: boolean; error?: string };

async function getSessionFromServer(): Promise<{ client_secret: any; instructions: string; voice?: string }> {
  const r = await fetch('/api/startChat', { method: 'POST' });
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = isJson ? (body.error || body.details || JSON.stringify(body)) : body;
    throw new Error(msg);
  }
  return body as { client_secret: any; instructions: string; voice?: string };
}

export async function startRealtimeCall(): Promise<StartResult> {
  try {
    // 1) מבקשים client_secret + instructions
    const { client_secret, instructions, voice } = await getSessionFromServer();
    const secret: string = client_secret?.value ?? client_secret;

    // 2) remote audio element (ללא playsInline על טיפוס TS)
    remoteAudioEl = document.getElementById('remote-audio') as HTMLAudioElement | null;
    if (!remoteAudioEl) {
      remoteAudioEl = document.createElement('audio');
      remoteAudioEl.id = 'remote-audio';
      remoteAudioEl.autoplay = true;
      remoteAudioEl.setAttribute('playsinline', 'true'); // אופציונלי; לא שובר TS
      document.body.appendChild(remoteAudioEl);
    }

    // 3) מיקרופון
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 4) PeerConnection + DataChannel
    pc = new RTCPeerConnection();
    dataChannel = pc.createDataChannel('oai-events');

    micStream.getTracks().forEach((t) => pc!.addTrack(t, micStream!));
    pc.addEventListener('track', (ev) => {
      const [remoteStream] = ev.streams;
      if (remoteAudioEl) remoteAudioEl.srcObject = remoteStream;
    });

    // 5) SDP Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 6) מחליפים SDP עם OpenAI באמצעות ה-client_secret
    const sdpResp = await fetch(
      'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp!,
      }
    );
    const answerSdp = await sdpResp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    // 7) כשערוץ הדאטה נפתח—מזריקים הנחיות ואז יוצרים תגובה
    dataChannel.addEventListener('open', () => {
      dataChannel!.send(
        JSON.stringify({
          type: 'session.update',
          session: { instructions, voice: voice ?? 'alloy' },
        })
      );
      dataChannel!.send(JSON.stringify({ type: 'response.create', response: {} }));
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

    if (remoteAudioEl) remoteAudioEl.srcObject = null;
  } catch (e) {
    console.warn('stopRealtimeCall error:', e);
  }
}
