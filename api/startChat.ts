// api/startChat.ts — Edge Runtime (Vercel)
// Realtime session עם קול alloy; ההנחיות באות מ-PROMPT_TEXT (string)

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  // כל הפרומפט שלך כמחרוזת (כולל משפט הפתיחה המדויק)
  const PROMPT_TEXT =
    process.env.PROMPT_TEXT ??
    `היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?
את מראיינת נשית, אמפתית ומקצועית... (המשך ההוראות שלך)`;

  try {
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
        // ערכים חוקיים: 'server_vad' או 'semantic_vad' (או להשמיט לגמרי)
        turn_detection: { type: "server_vad" },
        instructions: PROMPT_TEXT, // ← מחרוזת בלבד, לא prompt_id
      }),
    });

    if (!rt.ok) {
      const msg = await rt.text();
      return new Response(JSON.stringify({ error: msg }), {
        status: rt.status, headers: { "Content-Type": "application/json" },
      });
    }

    const session = await rt.json();
    return new Response(JSON.stringify({ session }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
