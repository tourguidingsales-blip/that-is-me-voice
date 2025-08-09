// ... קוד קיים ליצירת RTCPeerConnection וכו' ...

const dc = pc.createDataChannel("oai-events");

dc.onopen = () => {
  // קובע שוב voice ל-alloy (גיבוי)
  dc.send(JSON.stringify({
    type: "session.update",
    session: { voice: "alloy" }
  }));

  // מכריח פתיחה במשפט המדויק
  dc.send(JSON.stringify({
    type: "response.create",
    response: {
      instructions:
        'אמרי בדיוק, מילה במילה, ללא תוספות לפני/אחרי: "היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?"'
    }
  }));

  opts.onConnected?.();
};
