import React, { useRef, useState, useEffect } from "react";
import RealtimeVoiceCard from "./components/RealtimeVoiceCard";
import {
  connectRealtime,
  disconnectRealtime,
  type RealtimeHandle,
} from "./lib/realtimeClient";

// אותו משפט פתיחה – נשלח גם מהלקוח כגיבוי נוסף
const OPENING_LINE =
  'היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?';

type Status = "idle" | "connecting" | "connected" | "stopped" | "error";

export default function App() {
  const h = useRef<RealtimeHandle | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function startChat() {
    setStatus("connecting");
    setError(null);

    try {
      // 1) בקשת סשן מהשרת כדי לקבל client_secret
      const res = await fetch("/api/startChat", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || "startChat failed");
      }
      const clientSecret: string | undefined = data?.session?.client_secret?.value;
      if (!clientSecret) throw new Error("Missing client_secret from /api/startChat");

      // 2) חיבור ל-Realtime
      h.current = await connectRealtime({
        clientSecret,
        onConnected: () => {
          setStatus("connected");

          // גיבוי נוסף: שולחים שוב את משפט הפתיחה לאחר עליית הערוץ,
          // למקרה שהמודל אמר משהו אחר. שולחים פעמיים בהשהיה קצרה.
          try {
            const send = (delay: number) =>
              setTimeout(() => {
                try {
                  h.current?.dc?.send(
                    JSON.stringify({
                      type: "response.create",
                      response: { conversation: "none", instructions: OPENING_LINE },
                    })
                  );
                } catch {}
              }, delay);

            send(120); // מיד אחרי ההתחברות
            send(500); // חיזוק נוסף
          } catch {}
        },
        onDisconnected: () => setStatus("stopped"),
        onError: (e) => {
          const msg =
            e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
          setError(msg);
          setStatus("error");
        },
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
      setError(msg);
      setStatus("error");
    }
  }

  async function stopChat() {
    try {
      await disconnectRealtime(h.current);
    } catch {
      // מתעלמים משגיאות סגירה
    } finally {
      h.current = null;
      setStatus("stopped");
    }
  }

  // ניקוי חיבור אם יוצאים מהעמוד
  useEffect(() => {
    return () => {
      if (h.current) disconnectRealtime(h.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <RealtimeVoiceCard status={status} onStart={startChat} onStop={stopChat} />

      {error && (
        <div dir="rtl" className="mx-auto mt-4 w-[680px] max-w-[92vw]">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            שגיאה: {error}
          </div>
        </div>
      )}
    </div>
  );
}
