import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PRIMARY_VOICE = "alloy"; // קול נשי איכותי
const FALLBACK_VOICE = "verse"; // גיבוי במקרה של בעיה
const PROMPT_ID = "pmpt_689444b883a881959f896126cb070b630eed2a5504096065";

// פונקציה ליצירת סשן Realtime
async function createRealtimeSession(voice: string) {
  return fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice,
      instructions: "",
      conversation: PROMPT_ID,
    }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ניסיון ראשון עם alloy
    let sessionRes = await createRealtimeSession(PRIMARY_VOICE);

    // אם נכשל, ננסה עם verse
    if (!sessionRes.ok) {
      console.warn("⚠️ voice 'alloy' failed, retrying with 'verse'");
      sessionRes = await createRealtimeSession(FALLBACK_VOICE);
    }

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      console.error("❌ Failed to create session:", err);
      return res.status(500).json({ error: "Failed to create session" });
    }

    const data = await sessionRes.json();
    res.status(200).json(data);

  } catch (err) {
    console.error("❌ Error in /api/startChat:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
