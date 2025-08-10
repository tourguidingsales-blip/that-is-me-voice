// src/lib/realtimeClient.ts

export type ConnectOpts = {
  /** ה-JWT האפמרלי שהשרת מחזיר מ-/api/startChat */
  clientSecret: string;
  /** ההנחיות המלאות שמגיעות מהשרת (Supabase) */
  instructions: string;
  /** קול רלוונטי (ברירת מחדל alloy) */
  voice?: string;

  /** Callbacks אופציונליים */
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

export type RealtimeHandle = {
  stop: () => void;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
};

let pcGlobal: RTCPeerConnection | null = null;
let dcGlobal: RTCDataChannel | null = null;
let micStreamGlobal: MediaStream | null = null;

/**
 * יוצר חיבור WebRTC ל-OpenAI Realtime ושולח את ה-instructions מהשרת.
 * לא שולח שום טקסט פתיח קשיח מהקוד.
 */
export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  const model = 'gpt-4o-realtime-preview-2024-12-17';
  const voice = opts.voice ?? 'alloy';

  // מנקה חיבור קודם אם נשאר
  try { cleanup(); } catch {}

  // 1) מכין אלמנט אודיו ל-remote (ללא playsInline ב-TS)
  let remoteAudioEl = document.getElementById('remote-audio') as HTMLAudioElement | null;
  if (!remoteAudioEl) {
    remoteAudioEl = document.createElement('audio');
    remoteAudioEl.id = 'remote-audio';
    remoteAudioEl.autoplay = true;
    remoteAudioEl.setAttribute('playsinline', 'true');
    remoteAudioEl.style.display = 'none';
    document.body.appendChild(remoteAudioEl);
  }

  // 2) מבקש מיקרופון
  micStreamGlobal = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 3) PeerConnection
  const pc = new RTCPeerConnection();
  pcGlobal = pc;

  // הזרמת המיקרופון
  micStreamGlobal.getTracks().forEach((t) => pc.addTrack(t, micStreamGlobal!));

  // קבלת האודיו מהמודל
  pc.addEventListener('track', (ev) => {
    const [remoteStream] = ev.streams;
    if (remoteAudioEl) remoteAudioEl.srcObject = remoteStream;
  });

  // 4) DataChannel לאירועים
  const dc = pc.createDataChannel('oai-events');
  dcGlobal = dc;

  // 5) Offer/Answer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp ?? '',
  });

  const answerSdp = await sdpResp.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  // 6) כאשר ה-DataChannel נפתח – מזריקים את ההנחיות מה-DB ומפעילים תגובה ראשונה
  dc.addEventListener('open', () => {
    try {
      // session.update עם ה-instructions מהשרת (Supabase) + voice
      dc.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            instructions: opts.instructions,
            voice,
            // מומלץ להשאיר VAD בצד השרת כברירת מחדל
            // turn_detection: { type: 'server_vad' } <-- אם תרצה לעדכן אחרי ההקמה
          },
        })
      );

      // טריגר לפתיחת השיחה — ללא טקסט קשיח מהקוד
      dc.send(
        JSON.stringify({
          type: 'response.create',
          response: {},
        })
      );

      opts.onConnected?.();
    } catch (e) {
      opts.onError?.(e);
    }
  });

  // אירועי סיום/שגיאה
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      cleanup();
      opts.onDisconnected?.();
    }
  });

  return {
    stop: cleanup,
    pc,
    dc,
  };
}

/** סוגר ערוצים, עוצר טראקים ומנקה זיכרון */
export function cleanup(): void {
  try {
    dcGlobal?.close();
  } catch {}
  dcGlobal = null;

  try {
    pcGlobal?.getSenders().forEach((s) => s.track && s.track.stop());
    pcGlobal?.getReceivers().forEach((r) => r.track && r.track.stop());
    pcGlobal?.close();
  } catch {}
  pcGlobal = null;

  try {
    micStreamGlobal?.getTracks().forEach((t) => t.stop());
  } catch {}
  micStreamGlobal = null;

  const el = document.getElementById('remote-audio') as HTMLAudioElement | null;
  if (el) el.srcObject = null;
}
