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
  const [transcript, setTranscript] = useState<string>("");

  const appendText = useCallback((chunk: string) => {
    setTranscript((prev) => prev + chunk);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const h = await connectRealtime({
        onAssistantText: appendText,
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
  }, [appendText]);

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
    <div style={{ maxWidth: 760, margin: "60px auto", padding: 24 }}>
      <h1 style={{ textAlign: "center" }}>That Is Me</h1>
      <p style={{ textAlign: "center" }}>
        לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד לאחר אישור
        שימוש במיקרופון.
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {!connected ? (
          <button
            onClick={start}
            disabled={connecting}
            style={{
              padding: "12px 18px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            {connecting ? "מתחבר..." : "התחלת שיחה 🎙️"}
          </button>
        ) : (
          <button
            onClick={stop}
            style={{
              padding: "12px 18px",
              background: "#e11d48",
              color: "white",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            סיום שיחה
          </button>
        )}
      </div>

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

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          minHeight: 140,
          whiteSpace: "pre-wrap",
          direction: "rtl",
          textAlign: "right",
          background: "#fafafa",
        }}
      >
        {transcript || "כאן יופיעו הכתוביות במהלך השיחה..."}
      </div>
    </div>
  );
}
