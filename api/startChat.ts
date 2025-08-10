// api/startChat.ts — Edge Runtime (Vercel)
// מייצר סשן Realtime מול OpenAI כשההנחיות נמשכות ישירות מה-OpenAI Dashboard בעזרת PROMPT_ID.

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  // שמור את ה-Prompt ID מהדשבורד ב-Vercel כ-ENV בשם PROMPT_ID
  const PROMPT_ID =
    process.env.PROMPT_ID || "pmpt_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  try {
    // אופציונלי: יצירת conversation בסופאבייס כדי להחזיר מזהה
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

    // יצירת סשן Realtime:
    // שים לב: אין instructions מחרוזת; משתמשים prompt_id ברמת ה-session.
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
        turn_detection: { type: "server_vad" }, // ערכים תקינים: server_vad / semantic_vad
        prompt_id: PROMPT_ID,                   // ← כאן נכנס ה-Prompt ID מהדשבורד
      }),
    });

    if (!rt.ok) {
      const msg = await rt.text();
      return new Response(JSON.stringify({ error: msg }), {
        status: rt.status, headers: { "Content-Type": "application/json" },
      });
    }

    const session = await rt.json();
    return new Response(JSON.stringify({ session, conversationId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
