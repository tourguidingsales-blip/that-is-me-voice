// src/lib/realtimeClient.ts
// WebRTC client for OpenAI Realtime.
// ⚠️ בצד השרת (/api/startChat) נוצרת Session עם instructions מהדשבורד/Fallback.
// כאן בלקוח – אין instructions! שולחים רק טריגר יחיד של response.create,
// כדי שהפתיחה תגיע מהפרומפט שנקבע בשרת.

export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  stream?: MediaStream;
  close: () => Promise<void>;
};

export type ConnectOpts = {
  onAssistantText?: (chunk: string) => void; // טקסט/דלתות מהמודל (לכתוביות)
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

export async function connectRealtime(opts: ConnectOpts = {}): Promise<RealtimeHandle> {
  // 1) בקשה לשרת כדי ליצור Session (ולקבל ephemeral client_secret)
  let clientSecret: string | undefined;
  let model = "gpt-4o-realtime-preview";

  try {
    const res = await fetch("/api/startChat", { method: "POST" });

    // ננסה תמיד לפרסר JSON; אם לא – נזרוק שגיאה עם הטקסט הגולמי
    const json = await res.json().catch(async () => {
      const raw = await res.text();
      throw new Error(`Server returned non-JSON response: ${raw}`);
    });

    if (!res.ok) {
      const msg = json?.error || JSON.stringify(json);
      throw new Error(`startChat failed (${res.status}): ${msg}`);
    }

    // מבנה טיפוסי מה-OpenAI Sessions:
    // { session: { client_secret: { value: "..." }, model: "...", ... }, source: "dashboard|env_fallback" }
    const session = json?.session ?? json;
    clientSecret = session?.client_secret?.value || session?.client_secret?.secret || session?.client_secret;
    model = session?.model || model;

    if (!clientSecret) {
      throw new Error("Missing client_secret in /api/startChat response");
    }
  } catch (err) {
    opts.onError?.(err);
    throw err;
  }

  // 2) PeerConnection + פלט אודיו
  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e: RTCTrackEvent) => {
    audioEl.srcObject = e.streams[0];
  };

  // 3) DataChannel לאירועי המודל
  const dc = pc.createDataChannel("oai-events");

  // נדאג לשלוח טריגר response.create פעם אחת בלבד
  let triggered = false;

  dc.onopen = () => {
    try {
      // עדכון קול ברמת הסשן (גיבוי; ההגדרה הראשית בשרת)
      dc.send(JSON.stringify({ type: "session.update", session: { voice: "alloy" } }));

      // טריגר יחיד כדי שהמודל יפתח לפי ההנחיות שכבר קיימות בסשן מהשרת
      const trigger = () => {
        if (triggered) return;
        triggered = true;
        dc.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            modalities: ["audio", "text"],
            tts: { voice: "alloy" },
          }
        }));
      };

      // השהיה קצרה (לוודא שה-Session בצד OpenAI מוכן לפני הטריגר)
      setTimeout(trigger, 80);
    } catch (err) {
      opts.onError?.(err);
    }

    opts.onConnected?.();
  };

  dc.onclose = () => opts.onDisconnected?.();
  dc.onerror = (e) => opts.onError?.(e);

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

  // 4) מיקרופון (אודיו נכנס)
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
    const err = new Error("Microphone permission denied or unavailable");
    opts.onError?.(err);
    throw err;
  }

  // 5) SDP: Offer → Answer מול OpenAI Realtime
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
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

  // 6) מחזירים Handle עם סגירה נקייה
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
