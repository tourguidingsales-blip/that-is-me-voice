// תמלול דיבור המשתמש: מאזין למיקרופון ומזהה קטעים (VAD פשוט) ואז שולח ל-/api/transcribe

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let audioCtx: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let rafId: number | null = null;
let speaking = false;

export function initTranscriber({ onUserText }: { onUserText: (text: string) => void }) {
  cleanup();
  start(onUserText);
}

export function stopTranscriber() { cleanup(); }

async function start(onUserText: (text: string) => void) {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // ויזואליזציה/זיהוי שקט
  audioCtx = new AudioContext();
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);

  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: 'audio/webm' });
    chunks = [];
    const fd = new FormData();
    fd.append('audio', new File([blob], 'u.webm', { type: 'audio/webm' }));
    const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
    const { text } = await r.json();
    onUserText(text || '(לא נתפס דיבור)');
  };

  const threshold = 0.02; // סף פשוט; ניתן לכייל בהמשך
  const minSilenceMs = 800; // פרק זמן של שקט לסיום קטע
  let lastSpeech = Date.now();

  const buf = new Uint8Array(analyser.frequencyBinCount);
  const loop = () => {
    analyser!.getByteFrequencyData(buf);
    const avg = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
    const now = Date.now();

    if (avg > threshold) {
      lastSpeech = now;
      if (!speaking) {
        speaking = true;
        mediaRecorder!.start();
      }
    } else if (speaking && now - lastSpeech > minSilenceMs) {
      speaking = false;
      mediaRecorder!.stop();
    }
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

function cleanup() {
  try { if (rafId) cancelAnimationFrame(rafId); } catch {}
  try { mediaRecorder && mediaRecorder.state !== 'inactive' && mediaRecorder.stop(); } catch {}
  try { (mediaStream?.getTracks() || []).forEach(t => t.stop()); } catch {}
  try { sourceNode?.disconnect(); analyser?.disconnect(); audioCtx?.close(); } catch {}
  mediaStream = null; mediaRecorder = null; chunks = []; audioCtx = null; sourceNode = null; analyser = null; rafId = null; speaking = false;
}
