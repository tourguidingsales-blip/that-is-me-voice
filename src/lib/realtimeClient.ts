// src/lib/realtimeClient.ts

export type ConnectOpts = {
  /** ה־JWT האפמרלי מה- /api/startChat */
  clientSecret: string;
  /** כל ה-System Prompt שמגיע מהשרת (Supabase) */
  instructions: string;
  /** קול (ברירת מחדל alloy) */
  voice?: string;

  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

export type RealtimeHandle = {
  stop: () => void;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
};

// —— משפט הפתיחה הקשיח (אם תרצה לשנות – ערוך כאן בלבד) —— //
const OPENING_LINE =
  'היי, בוקר טוב, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?';

let pcGlobal: RTCPeerConnection | null = null;
let dcGlobal: RTCDataChannel | null = null;
let micStreamGlobal: MediaStream | null = null;

/** מנקה את כל המשאבים (ערוצים/טראקים/מדיה) */
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

/**
 * יוצר חיבור WebRTC ל-OpenAI Realtime.
 * - מזריק את ה-Instructions מהשרת (Supabase) אל ה-Session.
 * - שולח response ראשון עם משפט פתיחה קשיח מהקוד (OPENING_LINE).
 */
export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  const model = 'gpt-4o-realtime-preview-2024-12-17';
  const voice = opts.voice ?? 'alloy';

  // סגירה על כל מקרה של חיבור קודם
  cleanup();

  // אלמנט אודיו לזרם המרוחק
  let remoteAudioEl = document.getElementById('remote-audio') as HTMLAudioElement | null;
  if (!remoteAudioEl) {
    remoteAudioEl = document.createElement('audio');
    remoteAudioEl.id = 'remote-audio';
    remoteAudioEl.autoplay = true;
    remoteAudioEl.setAttribute('playsinline', 'true'); // לא משתמשים ב-prop שאינו בטייפים
    remoteAudioEl.style.display = 'none';
    document.body.appendChild(remoteAudioEl);
  }

  // מבקש מיקרופון
  micStreamGlobal = await navigator.mediaDevices.getUserMedia({ audio: true });

  // יוצר PeerConnection
  const pc = new RTCPeerConnection();
  pcGlobal = pc;

  // מזרים מיקרופון למודל
  micStreamGlobal.getTracks().forEach((t) => pc.addTrack(t, micStreamGlobal!));

  // מאזין לאודיו חוזר מהמודל
  pc.addEventListener('track', (ev) => {
    const [remoteStream] = ev.streams;
    if (remoteAudioEl) remoteAudioEl.srcObject = remoteStream;
  });

  // DataChannel לאירועי OAI
  const dc = pc.createDataChannel('oai-events');
  dcGlobal = dc;

  // Offer/Answer
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

  // כשהערוץ נפתח – מזריקים Session + פתיחה קשיחה כתגובה ראשונה
  dc.addEventListener('open', () => {
    try {
      // 1) session.update עם ההנחיות מה-DB (וכל שאר הכללים)
      dc.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            instructions: opts.instructions,
            voice,
            // turn_detection: { type: 'server_vad' }, // אפשרי אם תרצה
          },
        })
      );

      // 2) התגובה הראשונה – לומר מילה-במילה את משפט הפתיחה
      dc.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions: `אמור/י בדיוק ובמילים אלו בלבד: "${OPENING_LINE}"`,
            modalities: ['audio'],
          },
        })
      );

      opts.onConnected?.();
    } catch (e) {
      opts.onError?.(e);
    }
  });

  // ניתוק/כשל – ניקוי
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      cleanup();
      opts.onDisconnected?.();
    }
  });

  return { stop: cleanup, pc, dc };
}
