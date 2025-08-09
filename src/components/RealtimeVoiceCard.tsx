import React, { useState } from "react";
import { Mic, Square } from "lucide-react";

export default function RealtimeVoiceCard({
  onStart,
  onStop,
  status = "idle",
  disabled = false,
}: {
  onStart?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  status?: "idle" | "connecting" | "connected" | "stopped" | "error";
  disabled?: boolean;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  React.useEffect(() => setLocalStatus(status), [status]);

  const statusText: Record<typeof status, string> = {
    idle: "מוכן להתחלת שיחה",
    connecting: "מתחבר...",
    connected: "מחובר — השיחה פעילה",
    stopped: "השיחה הסתיימה",
    error: "אירעה שגיאה",
  } as const;

  const handleStart = async () => {
    if (disabled) return;
    try {
      await onStart?.();
    } catch (e) {}
  };
  const handleStop = async () => {
    if (disabled) return;
    try {
      await onStop?.();
    } catch (e) {}
  };

  return (
    <section dir="rtl" className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-slate-200">
        <h1 className="text-3xl font-extrabold text-slate-900 text-center">That Is Me</h1>
        <p className="text-slate-700 text-center mt-3 leading-relaxed">
          לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד
          לאחר אישור השימוש במיקרופון.
        </p>
        <div className="mt-5 text-center">
          <span
            className={
              "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border " +
              (localStatus === "connected"
                ? "bg-green-50 text-green-700 border-green-200"
                : localStatus === "connecting"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : localStatus === "error"
                ? "bg-red-50 text-red-700 border-red-200"
                : localStatus === "stopped"
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : "bg-slate-100 text-slate-700 border-slate-200")
            }
            aria-live="polite"
          >
            <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
            {statusText[localStatus as keyof typeof statusText]}
          </span>
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={handleStop}
            disabled={disabled || localStatus !== "connected"}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold shadow-sm border transition disabled:opacity-50 disabled:cursor-not-allowed bg-slate-200 text-slate-700 hover:bg-slate-300"
            aria-label="סיום שיחה"
          >
            <Square className="w-5 h-5" aria-hidden="true" />
            סיום שיחה
          </button>
          <button
            onClick={handleStart}
            disabled={disabled || localStatus === "connected" || localStatus === "connecting"}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="התחלת שיחה"
          >
            <Mic className="w-5 h-5" aria-hidden="true" />
            התחלת שיחה
          </button>
        </div>
      </div>
    </section>
  );
}
