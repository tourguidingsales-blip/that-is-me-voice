// src/App.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  connectRealtime,
  disconnectRealtime,
  type RealtimeHandle,
} from "./lib/realtimeClient";

type Status = "idle" | "connecting" | "connected" | "stopped" | "error";

export default function App() {
  const handleRef = useRef<RealtimeHandle | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assistantText, setAssistantText] = useState<string>("");

  async function startChat() {
    setStatus("connecting");
    setError(null);
    setAssistantText("");

    try {
      // 1) בקשת פתיחת סשן מהשרת כדי לקבל client_secret (ephemeral key)
      const res = await fetch("/api/startChat", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          (data && (data.error || data.message)) || "startChat failed"
        );
      }
      const clientSecret: string | undefined =
        data?.session?.client_secret?.value;

      if (!clientSecret) {
        throw new Error("Missing client_secret from /api/startChat response");
      }

      // 2) חיבור ל-Realtime
      handleRef.current = await connectRealtime({
        clientSecret,
        onAssistantText: (chunk) => {
          setAssistantText((prev) => prev + chunk);
        },
        onConnected: () => setStatus("connected"),
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
      await disconnectRealtime(handleRef.current);
    } catch (err: unknown) {
      // לא עוצר את ה-UI אם יש כשל בסגירה
      console.warn(
        err instanceof Error ? err.message : typeof err === "string" ? err : String(err)
      );
    } finally {
      handleRef.current = null;
      setStatus("stopped");
    }
  }

  // ניקוי בעת ניווט/ריענון
  useEffect(() => {
    return () => {
      if (handleRef.current) {
        disconnectRealtime(handleRef.current);
        handleRef.current = null;
      }
    };
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, Arial",
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: "92vw",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0 }}>That Is Me</h1>
        <p style={{ color: "#475569" }}>
          לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. לאחר האישור למיקרופון.
        </p>

        <div style={{ marginTop: 16 }}>
          {status !== "connected" ? (
            <button
              onClick={startChat}
              disabled={status === "connecting"}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                background: status === "connecting" ? "#93c5fd" : "#2563eb",
                color: "white",
                cursor: status === "connecting" ? "default" : "pointer",
                fontSize: 16,
              }}
            >
              {status === "connecting" ? "מתחבר..." : "התחלת שיחה"}
            </button>
          ) : (
            <button
              onClick={stopChat}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "white",
                color: "#0f172a",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              סיום שיחה
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 12,
              textAlign: "right",
              fontSize: 14,
            }}
          >
            שגיאה: {error}
          </div>
        )}

        {assistantText && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f1f5f9",
              color: "#0f172a",
              borderRadius: 12,
              textAlign: "right",
              minHeight: 60,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: 15,
            }}
          >
            {assistantText}
          </div>
        )}
      </div>
    </div>
  );
}
