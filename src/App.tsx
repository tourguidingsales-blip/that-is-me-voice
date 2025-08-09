import React, { useEffect, useState } from "react";
import { connectRealtime, disconnectRealtime } from "./lib/realtimeClient";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartChat = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectRealtime();
      setConnected(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleStopChat = () => {
    try {
      disconnectRealtime();
      setConnected(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error(String(err));
      }
    }
  };

  useEffect(() => {
    return () => {
      if (connected) {
        disconnectRealtime();
      }
    };
  }, [connected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "50px" }}>
      <h1>That Is Me</h1>
      {!connected ? (
        <button onClick={handleStartChat} disabled={connecting}>
          {connecting ? "מתחבר..." : "התחלת שיחה"}
        </button>
      ) : (
        <button onClick={handleStopChat}>סיום שיחה</button>
      )}
      {error && <p style={{ color: "red" }}>שגיאה: {error}</p>}
    </div>
  );
}
