// api/startChat.ts — Edge Runtime
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const PROMPT_TEXT =
    process.env.PROMPT_TEXT ??
    `היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?
(כאן המשך כל ההנחיות שלך...)`;

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        modalities: ["audio", "text"],
        voice: "alloy",
        turn_detection: { type: "server_vad" }, // או semantic_vad / להשמיט
        instructions: PROMPT_TEXT,             // ← חייב להיות STRING, לא prompt_id
      }),
    });

    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}

    if (!r.ok) {
      return new Response(JSON.stringify({
        error: "OpenAI request failed",
        details: data ?? text,
      }), { status: r.status, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: String(err),
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
