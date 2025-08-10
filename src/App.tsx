// src/App.tsx
import { useState } from 'react';
import { startRealtimeCall, stopRealtimeCall } from './lib/realtimeClient';

export default function App() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onStart = async () => {
    setErr(null);
    setBusy(true);
    const res = await startRealtimeCall();
    if (!res.ok) setErr(`שגיאה: ${res.error}`);
    setBusy(false);
  };

  const onStop = () => stopRealtimeCall();

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>That Is Me</h1>
      <p style={{ marginBottom: 20 }}>
        לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד לאחר אישור שימוש במיקרופון.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
        <button
          onClick={onStart}
          disabled={busy}
          style={{
            padding: '14px 22px',
            fontSize: 18,
            borderRadius: 10,
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            background: '#1a73e8',
            color: 'white',
          }}
        >
          🎙️ התחלת שיחה
        </button>
        <button
          onClick={onStop}
          style={{
            padding: '14px 22px',
            fontSize: 18,
            borderRadius: 10,
            border: '1px solid #ddd',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          ⏹️ סיום שיחה
        </button>
      </div>

      {err && (
        <div style={{ background: '#ffe6e6', color: '#a50000', padding: '12px 16px', borderRadius: 8 }}>
          {err}
        </div>
      )}

      {/* אלמנט האודיו לניגון ה-remote (ללא playsInline ב-TSX) */}
      <audio id="remote-audio" autoPlay style={{ display: 'none' }} />
    </div>
  );
}
