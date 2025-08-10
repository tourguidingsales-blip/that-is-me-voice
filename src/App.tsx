// src/App.tsx
import { useCallback, useRef, useState } from "react";
import {
  connectRealtime,
  disconnectRealtime,
  type RealtimeHandle,
} from "./lib/realtimeClient";

export default function App() {
  const handleRef = useRef<RealtimeHandle | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const h = await connectRealtime({
        onConnected: () => setConnected(true),
        onDisconnected: () => setConnected(false),
        onError: (e) =>
          setError(e instanceof Error ? e.message : String(e)),
      });
      handleRef.current = h;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await disconnectRealtime(handleRef.current);
      handleRef.current = null;
      setConnected(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div style={{ maxWidth: 760, margin: "60px auto", padding: 24, textAlign: "center", direction: "rtl" }}>
      <h1>That Is Me</h1>
      <p>לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד לאחר אישור שימוש במיקרופון.</p>

      {!connected ? (
        <button
          onClick={start}
          disabled={connecting}
          style={{
            padding: "14px 22px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          {connecting ? "מתחבר..." : "התחלת שיחה 🎙️"}
        </button>
      ) : (
        <button
          onClick={stop}
          style={{
            padding: "14px 22px",
            background: "#e11d48",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          סיום שיחה
        </button>
      )}

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          שגיאה: {error}
        </div>
      )}
    </div>
  );
}
