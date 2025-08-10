// api/startChat.ts — Edge Runtime (Vercel)
// יוצר סשן Realtime מול OpenAI. ההנחיות באות מ-PROMPT_TEXT (string).
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  // חשוב: חייב להיות STRING. שים כאן את כל הטקסט שלך כולל משפט הפתיחה המדויק
  const PROMPT_TEXT =
    process.env.PROMPT_TEXT ??
    `את מראיינת נשית, אמפתית ומקצועית. עברית בלבד. אל תפתחי לבד; דברי רק בהתאם לשיחה.`;

  try {
    // (אופציונלי) יצירת שיחה בסופאבייס כדי להחזיר conversationId
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

    // יצירת סשן Realtime: instructions חייב להיות מחרוזת
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
        // ערכים נתמכים: 'server_vad' או 'semantic_vad'. אפשר גם להשמיט לגמרי.
        turn_detection: { type: "server_vad" },
        instructions: PROMPT_TEXT, // ← כאן צריך להיות כל הפרומפט שלך כמחרוזת
      }),
    });

    if (!rt.ok) {
      const msg = await rt.text();
      return new Response(JSON.stringify({ error: msg }), {
        status: rt.status,
        headers: { "Content-Type": "application/json" },
      });
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
