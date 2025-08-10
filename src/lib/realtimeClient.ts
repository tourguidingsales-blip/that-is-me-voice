// src/lib/realtimeClient.ts
// חיבור WebRTC למודל Realtime של OpenAI (Edge) + כפיית קול ומשפט פתיחה מדויק.

export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  close: () => Promise<void>;
};

type ConnectOpts = {
  clientSecret: string; // ephemeral key שמתקבל מ- /api/startChat
  onAssistantText?: (chunk: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: any) => void;
};

export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  if (!opts.clientSecret) {
    throw new Error("Missing clientSecret (ephemeral key) from /api/startChat");
  }

  // PeerConnection
  const pc = new RTCPeerConnection();

  // אודיו נכנס
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];
  };

  // DataChannel לאירועי המודל
  const dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    // ננעל קול נשי איכותי (alloy) גם בצד הלקוח
    try {
      dc.send(
        JSON.stringify({
          type: "session.update",
          session: { voice: "alloy" },
        })
      );
    } catch {}

    // נכריח את משפט הפתיחה המדויק – ייאמר מיד כשנפתחת השיחה
    try {
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              'אמרי בדיוק, מילה במילה, ללא תוספות לפני/אחרי: "היי, בוקר טוב, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?"',
          },
        })
      );
    } catch {}

    opts.onConnected?.();
  };

  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e) => opts.onError?.(e);

  // פיענוח טקסטים מהמודל (מגיב גם לדלתות וגם לפלט מלא)
  dc.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);

      // דלתות טקסט
      if (msg?.type === "response.output_text.delta" && typeof msg.delta === "string") {
        opts.onAssistantText?.(msg.delta);
        return;
      }
      // פלט טקסט מלא
      if (msg?.type === "response.output_text" && typeof msg.text === "string") {
        opts.onAssistantText?.(msg.text);
        return;
      }
      // חלק מהמימושים שולחים אירוע כללי עם 'delta'
      if (typeof msg?.delta === "string") {
        opts.onAssistantText?.(msg.delta);
        return;
      }
    } catch {
      // הודעות לא-JSON – מתעלמים
    }
  };

  // הוספת מיקרופון
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  } catch (e) {
    opts.onError?.(new Error("Microphone permission denied or unavailable"));
    throw e;
  }

  // יצירת Offer ושליחתו ל-OpenAI לקבלת Answer
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
