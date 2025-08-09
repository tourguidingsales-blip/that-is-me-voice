// api/startChat.ts — Edge Runtime
// יוצר סשן Realtime כשההנחיות נלקחות ישירות מה-OpenAI Prompt ID (מהדשבורד)

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  // הגדר כאן את ה-Prompt ID מהדשבורד (או דרך ENV בשם PROMPT_ID)
  const PROMPT_ID =
    process.env.PROMPT_ID ||
    "pmpt_689444b883a881959f896126cb070b630eed2a5504096065"; // ← החלף אם צריך

  try {
    // (אופציונלי) יצירת מזהה שיחה ב-Supabase להמשך שמירת תמלול/מטא
    let conversationId: string;
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
    } else {
      conversationId = crypto.randomUUID();
    }

    // יצירת session ב-OpenAI Realtime: קול alloy, ללא instructions בטקסט — רק prompt_id
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
        // השארת turn_detection כבוי כדי שלא תתחיל לדבר לבד לפני הטריגר מהלקוח
        turn_detection: { type: "none" },
        // חשוב: ההנחיות מגיעות מהדשבורד דרך ה-Prompt ID
        instructions: { prompt_id: PROMPT_ID },
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
