import React from "react";

type Props = {
  status: "idle" | "connecting" | "connected" | "stopped" | "error";
  onStart: () => void;
  onStop: () => void;
};

export default function RealtimeVoiceCard({ status, onStart, onStop }: Props) {
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";

  return (
    <div
      dir="rtl"
      className="mx-auto mt-16 w-[680px] max-w-[92vw] rounded-2xl bg-white p-8 shadow-xl"
    >
      <h1 className="mb-3 text-center text-4xl font-extrabold text-slate-900">
        That Is Me
      </h1>
      <p className="text-center text-lg text-slate-600">
        לחץ על "התחלת שיחה" כדי להתחיל בשיחה קולית. השיחה תתחיל מיד
        לאחר אישור השימוש במיקרופון.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <span
          className={`rounded-full px-4 py-2 text-sm ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : isConnecting
              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              : status === "error"
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
              : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          {isConnected ? "מחובר" : isConnecting ? "…מתחבר" : status === "error" ? "שגיאה" : "מוכן"}
        </span>
      </div>

      <div className="mt-8 flex items-center justify-center gap-6">
        {!isConnected ? (
          <button
            onClick={onStart}
            disabled={isConnecting}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-white shadow-sm transition ${
              isConnecting ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            התחלת שיחה
            <span className="ml-2">🎙️</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-slate-800 shadow-sm hover:bg-slate-50"
          >
            סיום שיחה
          </button>
        )}
      </div>
    </div>
  );
}
