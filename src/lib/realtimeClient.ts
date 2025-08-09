// src/lib/realtimeClient.ts
// WebRTC <> OpenAI Realtime (Edge) + כפיית קול alloy ומשפט פתיחה מדויק

export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  stream?: MediaStream;
  close: () => Promise<void>;
};

export type ConnectOpts = {
  clientSecret: string;                       // ephemeral key מ- /api/startChat
  onAssistantText?: (chunk: string) => void;  // דלתות/טקסט מלא מהמודל
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

const OPENING_LINE =
  'היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?';

export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  if (!opts.clientSecret) {
    throw new Error("Missing clientSecret (ephemeral key) from /api/startChat");
  }

  // 1) PeerConnection + אודיו נכנס
  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e: RTCTrackEvent) => {
    audioEl.srcObject = e.streams[0];
  };

  // 2) DataChannel לאירועי המודל
  const dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    try {
      // נכפה קול alloy גם בצד הלקוח (כגיבוי לשרת)
      dc.send(JSON.stringify({
        type: "session.update",
        session: { voice: "alloy" }
      }));

      // מכריח משפט פתיחה מדויק – בלי להיעזר בקונטקסט קודם
      dc.send(JSON.stringify({
        type: "response.create",
        response: {
          conversation: "none",        // לא להשתמש בזיכרון קיים
          instructions: OPENING_LINE   // מילה במילה
        }
      }));
    } catch (err) {
      opts.onError?.(err);
    }

    opts.onConnected?.();
  };

  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e: Event) => opts.onError?.(e);

  // קריאת טקסטים היוצאים מהמודל (דלתה/מלא)
  dc.onmessage = (evt: MessageEvent) => {
    try {
      const msg = JSON.parse(String(evt.data));

      if (msg?.type === "response.output_text.delta" && typeof msg.delta === "string") {
        opts.onAssistantText?.(msg.delta);
        return;
      }
      if (msg?.type === "response.output_text" && typeof msg.text === "string") {
        opts.onAssistantText?.(msg.text);
        return;
      }
      if (typeof msg?.delta === "string") {
        opts.onAssistantText?.(msg.delta);
        return;
      }
    } catch {
      // הודעות שאינן JSON — מתעלמים
    }
  };

  // 3) מיקרופון
  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream as MediaStream));
  } catch (e) {
    opts.onError?.(new Error("Microphone permission denied or unavailable"));
    throw e;
  }

  // 4) SDP Offer → Answer מה-API
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(
    "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp as string,
    }
  );

  if (!sdpRes.ok) {
    const t = await sdpRes.text();
    const err = new Error(`SDP exchange failed (${sdpRes.status}): ${t.slice(0, 300)}`);
    opts.onError?.(err);
    throw err;
  }

  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: await sdpRes.text(),
  };
  await pc.setRemoteDescription(answer);

  // 5) מחזירים Handle כולל פונקציית סגירה
  const handle: RealtimeHandle = {
    pc,
    dc,
    stream,
    close: async () => {
      try { dc?.close(); } catch {}
      try { pc.close(); } catch {}
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    },
  };

  return handle;
}

// API תואם לקוד הקיים
export async function disconnectRealtime(handle?: RealtimeHandle | null): Promise<void> {
  if (!handle) return;
  await handle.close();
}
