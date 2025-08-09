import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  try {
    // 1) יצירת רשומת שיחה (לוגית) כדי לקבל conversationId
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
      if (!convRes.ok) throw new Error(`Supabase create conversation failed: ${await convRes.text()}`);
      const [conv] = await convRes.json();
      conversationId = conv.id as string;
    } else {
      // fallback לוגי בלבד (לא יישמר לסופאבייס בלי envs)
      conversationId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`;
    }

    // 2) הנחיות (System Prompt) – אפשר להחליף בפרומפט המלא שלך
    const instructions = `
את מראיינת נשית, אמפתית ומקצועית. עברית בלבד. דברי לאט, משפטים קצרים, עם הקשבה אמפתית ושאלות המשך עדינות. פתיחה: בבקשה לשאול איך לפנות (זכר/נקבה/אחר) ומה השם. הימנעי מייעוץ רפואי/משפטי. אם מתגלה מצוקה – הציעי הפסקה ועדינות. סגירה רכה עם תודה.`;

    // 3) בקשת סשן Realtime (קול נשי כברירת מחדל)
    const rt = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        modalities: ["audio", "text"],
        voice: "female", // נסה גם "luna"/"aria"/"nora" אם קיים אצלך
        instructions,
      }),
    });

    if (!rt.ok) throw new Error(`OpenAI Realtime session failed: ${await rt.text()}`);
    const session = await rt.json();

    return new Response(JSON.stringify({ session, conversationId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
