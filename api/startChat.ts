import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  try {
    const instructions = `את מראיינת נשית, אמפתית ומקצועית. עברית בלבד...`;

    const rt = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",   // בלי תאריך סמן
        modalities: ["audio","text"],
        voice: "alloy",                     // קול נשי
        instructions
      }),
    });

    if (!rt.ok) {
      const msg = await rt.text();
      throw new Error(`Realtime session failed: ${msg}`);
    }
    const session = await rt.json();
    return new Response(JSON.stringify({ session }), { headers: { "Content-Type": "application/json" } });
  } catch (e:any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}
