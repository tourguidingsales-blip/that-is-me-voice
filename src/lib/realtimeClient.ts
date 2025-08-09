// src/lib/realtimeClient.ts
export async function connectRealtime(opts: ConnectOpts): Promise<RealtimeHandle> {
  if (!opts.clientSecret) throw new Error("Missing clientSecret");

  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

  const dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    // קביעת קול נשי
    dc.send(JSON.stringify({
      type: "session.update",
      session: { voice: "alloy" }
    }));

    // שליחת משפט הפתיחה המדויק
    dc.send(JSON.stringify({
      type: "response.create",
      response: {
        conversation: "none",
        instructions: "היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?"
      }
    }));

    opts.onConnected?.();
  };

  // שאר הקוד שלך נשאר זהה...
}
