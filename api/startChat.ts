// api/startChat.ts — Edge Runtime (uses PROMPT_TEXT as string)
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const PROMPT_TEXT =
    process.env.PROMPT_TEXT ||
    "את מראיינת נשית, אמפתית ומקצועית. עברית בלבד. אל תפתחי לבד; דברי רק לפי ההנחיות.";

  try {
    // אופציונלי: יצירת שיחה ב-Supabase
    let conversationId = crypto.randomUUID();
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
      const convRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ title: "That Is Me — Realtime Chat" }),
      });
      if (!convRes.ok) throw new Error(await convRes.text());
      const [conv] = await convRes.json();
      conversationId = conv.id;
    }

    // יצירת סשן Realtime – instructions חייב להיות string
    const rt = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        modalities: ["audio", "text"],
        voice: "alloy",
        turn_detection: { type: "none" },
        instructions: PROMPT_TEXT, // <-- מחרוזת בלבד
      }),
    });

    if (!rt.ok) {
      const msg = await rt.text();
      throw new Error(`Realtime session failed: ${msg}`);
    }

    const session = await rt.json();
    return new Response(JSON.stringify({ session, conversationId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
