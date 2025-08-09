// ... יצירת ה-RTCPeerConnection וה-DataChannel כרגיל
const dc = pc.createDataChannel("oai-events");

dc.onopen = () => {
  // נכפה את הקול ל-alloy גם אם השרת לא קבע
  try {
    dc.send(JSON.stringify({
      type: "session.update",
      session: { voice: "alloy" }   // <-- כאן הקסם
    }));
  } catch {}
  opts.onConnected?.();
};
