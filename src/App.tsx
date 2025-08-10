// src/App.tsx
import { useState } from 'react';
import { connectRealtime, cleanup, type RealtimeHandle } from './lib/realtimeClient';

export default function App() {
  const [handle, setHandle] = useState<RealtimeHandle | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  async function startChat() {
    if (isConnecting || isRunning) return;
    setIsConnecting(true);

    try {
      // מבקש מהשרת סשן + הנחיות (מ-Supabase)
      const r = await fetch('/api/startChat', { method: 'POST' });
      if (!r.ok) throw new Error('startChat failed');
      const data = await r.json();

      const h = await connectRealtime({
        clientSecret: data.client_secret?.value ?? data.client_secret,
        instructions: data.instructions, // כל הטקסט מה-DB
        voice: data.voice ?? 'alloy',
        onConnected: () => setIsRunning(true),
        onDisconnected: () => setIsRunning(false),
        onError: (e) => console.error(e),
      });

      setHandle(h);
    } catch (err) {
      console.error(err);
      alert('שגיאה בהתחלת השיחה');
    } finally {
      setIsConnecting(false);
    }
  }

  function stopChat() {
    try { handle?.stop(); } catch {}
    setHandle(null);
    setIsRunning(false);
  }

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
          טיוטת צ'טבוט התחקיר
        </h1>

        <p className="text-center text-gray-600 mb-8">
          לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד לאחר אישור שימוש במיקרופון.
        </p>

        {/* כפתורים: התחלה בימין (כחול), סיום בשמאל (אדום) */}
        <div className="flex flex-row-reverse items-center justify-between gap-4">
          <button
            onClick={startChat}
            disabled={isConnecting || isRunning}
            className={`inline-flex items-center justify-center px-6 py-3 rounded-xl text-white transition
              ${isRunning ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            aria-label="התחלת שיחה"
          >
            התחלת שיחה
            <span className="ml-2">🎙️</span>
          </button>

          <button
            onClick={stopChat}
            disabled={!isRunning}
            className={`inline-flex items-center justify-center px-6 py-3 rounded-xl text-white transition
              ${!isRunning ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
            aria-label="סיום שיחה"
          >
            סיום שיחה
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isConnecting ? 'מתחבר…' : isRunning ? 'שיחה פעילה' : 'מוכן להתחלת שיחה'}
        </div>
      </div>
    </div>
  );
}
