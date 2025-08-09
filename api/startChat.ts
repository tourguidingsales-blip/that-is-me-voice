import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

async function createRealtimeSession(OPENAI_API_KEY: string, voice: string, instructions: string) {
  const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      modalities: ["audio", "text"],
      voice,
      instructions,
    }),
  });
  return resp;
}

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  try {
    // 1) צור רשומת שיחה לקבלת conversationId (אם יש Supabase)
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
      conversationId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`;
    }

    // 2) הנחיות קצרות (יש לך גרסה מלאה—אפשר להדביק כאן)
    const instructions = `את מראיינת נשית, אמפתית ומקצועית. עברית בלבד, דיבור איטי-בינוני, משפטים קצרים. פתיחה בשאלת לשון פנייה ושם. שאלות המשך עדינות, ללא ייעוץ רפואי/משפטי. במקרה מצוקה להציע הפסקה. סגירה רכה ותודה.`;

    // 3) ניסיון ראשון עם קול נשי; אם נכשל—נופלים ל-"verse"
    const primaryVoice = "female";
    let rt = await createRealtimeSession(OPENAI_API_KEY, primaryVoice, instructions);

    if (!rt.ok) {
      const msg = await rt.text();
      // fallback
      console.log("realtime session failed with 'female', retrying with 'verse' →", msg.slice(0, 200));
      rt = await createRealtimeSession(OPENAI_API_KEY, "verse", instructions);
      if (!rt.ok) {
        const msg2 = await rt.text();
        throw new Error(`OpenAI Realtime session failed (verse fallback): ${msg2}`);
      }
    }

    const session = await rt.json();

    if (!session?.client_secret?.value) {
      throw new Error("Missing client_secret in Realtime session response");
    }

    return new Response(JSON.stringify({ session, conversationId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
