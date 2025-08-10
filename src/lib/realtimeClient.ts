// src/lib/realtimeClient.ts
// WebRTC ↔ OpenAI Realtime
// ⚠️ אין instructions בצד הלקוח. ה-Prompt מגיע מהדשבורד (prompt_id בסשן).
// שולחים טריגר יחיד של response.create כדי שהמודל יפתח לפי הפרומפט בדשבורד.

export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  stream?: MediaStream;
  close: () => Promise<void>;
};

export type ConnectOpts = {
  clientSecret: string;                       // ephemeral key שהשרת מחזיר מ-/api/startChat
  onAssistantText?: (chunk: string) => void;  // טקסט/דלתות מהמודל (לכתוביות)
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  if (!opts.clientSecret) throw new Error("Missing clientSecret (ephemeral)");

  // 1) PeerConnection + פלט אודיו
  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e: RTCTrackEvent) => {
    audioEl.srcObject = e.streams[0];
  };

  // 2) DataChannel לאירועי המודל
  const dc = pc.createDataChannel("oai-events");

  // דואגים לשלוח טריגר פעם אחת בלבד
  let triggered = false;

  dc.onopen = () => {
    try {
      // נועל קול "alloy" ברמת הסשן (גיבוי)
      dc.send(JSON.stringify({ type: "session.update", session: { voice: "alloy" } }));

      // טריגר יחיד כדי שהמודל יפתח לפי ה-Prompt בדשבורד
      const trigger = () => {
        if (triggered) return;
        triggered = true;
        dc.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            modalities: ["audio", "text"], // נשמע קול וגם נקבל טקסט
            tts: { voice: "alloy" },
          }
        }));
      };

      // השהיה קצרה כדי לוודא שה-session מוכן לפני הטריגר
      setTimeout(trigger, 80);
    } catch (err) {
      opts.onError?.(err);
    }

    opts.onConnected?.();
  };

  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e: Event) => opts.onError?.(e);

  // פענוח טקסטים/דלתות מהמודל (לכתוביות)
  dc.onmessage = (evt: MessageEvent) => {
    try {
      const msg = JSON.parse(String(evt.data));
      if (msg?.type === "response.output_text.delta" && typeof msg.delta === "string") {
        opts.onAssistantText?.(msg.delta);
      } else if (msg?.type === "response.output_text" && typeof msg.text === "string") {
        opts.onAssistantText?.(msg.text);
      } else if (typeof msg?.delta === "string") {
        opts.onAssistantText?.(msg.delta);
      }
    } catch {
      // פריימים שאינם JSON — מתעלמים
    }
  };

  // 3) מיקרופון (אודיו נכנס)
  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
  } catch (e) {
    opts.onError?.(new Error("Microphone permission denied or unavailable"));
    throw e;
  }

  // 4) SDP: Offer → Answer מול OpenAI Realtime
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
    const err = new Error(`SDP exchange failed (${sdpRes.status}): ${t.slice(0, 400)}`);
    opts.onError?.(err);
    throw err;
  }

  const answer: RTCSessionDescriptionInit = { type: "answer", sdp: await sdpRes.text() };
  await pc.setRemoteDescription(answer);

  // 5) מחזירים Handle עם סגירה נקייה
  return {
    pc,
    dc,
    stream,
    close: async () => {
      try { dc?.close(); } catch {}
      try { pc.close(); } catch {}
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    },
  };
}

export async function disconnectRealtime(handle?: RealtimeHandle | null): Promise<void> {
  if (!handle) return;
  await handle.close();
}
