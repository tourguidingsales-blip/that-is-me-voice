// חיבור WebRTC ל-OpenAI Realtime, עם טיפול שגיאות ברור
export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  close: () => Promise<void>;
};

export async function connectRealtime(opts: {
  clientSecret: string;
  onAssistantText?: (chunk: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: any) => void;
}): Promise<RealtimeHandle> {
  if (!opts.clientSecret) {
    throw new Error("Missing clientSecret (ephemeral key) from startChat()");
  }

  const pc = new RTCPeerConnection();

  // נגן לאודיו נכנס
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];
  };

  // DataChannel
  const dc = pc.createDataChannel("oai-events");
  dc.onopen = () => opts.onConnected?.();
  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e) => opts.onError?.(e);
  dc.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg?.type?.includes("output_text") && (msg.text || msg.delta)) {
        opts.onAssistantText?.(msg.text || msg.delta);
      }
    } catch {
      // מתעלמים ממסרים לא-JSON
    }
  };

  // הוספת מיקרופון
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  } catch (e) {
    opts.onError?.(new Error("Microphone permission denied or unavailable"));
    throw e;
  }

  // Offer → Realtime Answer
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  // שליחת ה-SDP ל-OpenAI
  const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp as string,
  });

  if (!sdpRes.ok) {
    const t = await sdpRes.text();
    const err = new Error(`SDP exchange failed (${sdpRes.status}): ${t.slice(0, 300)}`);
    opts.onError?.(err);
    throw err;
  }

  const answer = { type: "answer", sdp: await sdpRes.text() } as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(answer);

  return {
    pc,
    dc,
    close: async () => {
      try {
        dc?.close();
      } catch {}
      try {
        pc.close();
      } catch {}
      try {
        (stream?.getTracks() || []).forEach((t) => t.stop());
      } catch {}
    },
  };
}

export async function disconnectRealtime(handle?: RealtimeHandle | null) {
  if (!handle) return;
  await handle.close();
}
