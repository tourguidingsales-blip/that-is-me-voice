// api/startChat.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview", // מודל בזמן אמת
        modalities: ["audio", "text"],    // אודיו וטקסט
        voice: "alloy",                   // קול Alloy
        turn_detection: { type: "server_vad" }, // זיהוי סוף דיבור בצד השרת
        prompt_id: "pmpt_689444b883a881959f896126cb070b630eed2a5504096065" // פרומפט מהדשבורד
      }),
    });

    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("Error creating Realtime session:", err);
    res.status(500).json({ error: "Failed to create Realtime session" });
  }
}
