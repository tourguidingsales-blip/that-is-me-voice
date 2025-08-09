// חיבור WebRTC ל-OpenAI Realtime. ניגן אודיו נכנס ומוציא אירועי טקסט מהעוזרת.
export type RealtimeHandle = { pc: RTCPeerConnection; dc?: RTCDataChannel; close: () => Promise<void> };

export async function connectRealtime(opts: {
  clientSecret: string
  onAssistantText?: (chunk: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (e: any) => void
}): Promise<RealtimeHandle> {
  const pc = new RTCPeerConnection();

  // נגן לאודיו נכנס
  const audioEl = document.createElement('audio');
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
    // צפוי JSON של אירועי realtime; מחפשים טקסטים שהעוזרת מייצרת
    try {
      const msg = JSON.parse(evt.data);
      // דוגמה: { type: 'response.output_text.delta', text: '...' }
      if (msg?.type?.includes('output_text') && (msg.text || msg.delta)) {
        opts.onAssistantText?.(msg.text || msg.delta);
      }
    } catch {}
  };

  // הוספת מיקרופון
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) pc.addTrack(track, stream);

  // Offer → OpenAI Realtime Answer
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  // שליחת ה-Offer ל-OpenAI עם ה-ephemeral client secret
  const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      "Content-Type": "application/sdp"
    },
    body: offer.sdp as string
  });
  const answer = { type: 'answer', sdp: await sdpRes.text() } as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(answer);

  return {
    pc,
    dc,
    close: async () => {
      try { dc?.close(); } catch {}
      try { pc.close(); } catch {}
      try { (stream.getTracks()||[]).forEach(t => t.stop()); } catch {}
    }
  };
}

export async function disconnectRealtime(handle?: RealtimeHandle | null) {
  if (!handle) return;
  await handle.close();
}
