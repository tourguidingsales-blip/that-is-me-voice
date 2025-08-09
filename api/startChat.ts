// api/startChat.ts — Edge Runtime
// יוצר סשן Realtime עם קול alloy, פרומפט מטקסט ב-ENV, ו-turn_detection תקין.

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  // הפרומפט מגיע מ-ENV כמחרוזת (לא אובייקט!)
  const PROMPT_TEXT =
    process.env.PROMPT_TEXT ||
    `את מראיינת נשית, אמפתית ומקצועית. עברית בלבד. 
אל תפתחי לבד; דברי רק בהתאם לשיחה.`;

  try {
    // אופציונלי: יצירת שורה בטבלת conversations ולהחזיר conversationId
    let conversationId: string = crypto.randomUUID();
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

    // יצירת Session מול OpenAI Realtime
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
        // ערכים תקינים כיום: 'server_vad' או 'semantic_vad'
        turn_detection: { type: "server_vad" },
        // חייב להיות STRING (לא prompt_id)!
        instructions: PROMPT_TEXT,
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
