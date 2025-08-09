// src/lib/realtimeClient.ts
export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  close: () => Promise<void>;
};

type ConnectOpts = {
  clientSecret: string;
  onAssistantText?: (chunk: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: any) => void;
};

export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  if (!opts.clientSecret) {
    throw new Error("Missing clientSecret (ephemeral key) from /api/startChat");
  }

  const pc = new RTCPeerConnection();

  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];
  };

  const dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    try {
      // קביעת קול נשי
      dc.send(JSON.stringify({
        type: "session.update",
        session: { voice: "alloy" }
      }));

      // שליחת משפט פתיחה מדויק בלי קשר לקונטקסט קודם
      dc.send(JSON.stringify({
        type: "response.create",
        response: {
          conversation: "none", // לא משתמש בהיסטוריית השיחה
          instructions:
            'היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?'
        }
      }));
    } catch (err) {
      opts.onError?.(err);
    }

    opts.onConnected?.();
  };

  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e) => opts.onError?.(e);

  dc.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg?.type === "response.output_text.delta" && typeof msg.delta === "string") {
        opts.onAssistantText?.(msg.delta);
      } else if (msg?.type === "response.output_text" && typeof msg.text === "string") {
        opts.onAssistantText?.(msg.text);
      }
    } catch { }
  };

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  } catch (e) {
    opts.onError?.(new Error("Microphone permission denied or unavailable"));
    throw e;
  }

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

  return {
    pc,
    dc,
    close: async () => {
      try { dc?.close(); } catch { }
      try { pc.close(); } catch { }
      try { (stream?.getTracks() || []).forEach((t) => t.stop()); } catch { }
    },
  };
}

export async function disconnectRealtime(handle?: RealtimeHandle | null) {
  if (!handle) return;
  await handle.close();
}
