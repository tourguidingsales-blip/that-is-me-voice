// api/startChat.ts — Edge Runtime (Vercel)
// 1) מנסה להביא את הפרומפט מה-Dashboard לפי PROMPT_ID (לא מובטח בכל החשבונות).
// 2) אם נכשל—נופל ל-PROMPT_TEXT מה-ENV.
// 3) יוצר סשן Realtime עם instructions כמחרוזת.
// 4) תמיד מחזיר JSON (גם בשגיאה) כדי שה-frontend לא יקרוס.

export const config = { runtime: "edge" };

type AnyJson = Record<string, any>;

function extractPromptText(obj: AnyJson | null): string | null {
  if (!obj) return null;
  // ניסיונות לחלץ טקסט מתוך צורות נפוצות:
  if (typeof obj.instructions === "string") return obj.instructions;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.content === "string") return obj.content;
  if (obj.prompt && typeof obj.prompt.instructions === "string") return obj.prompt.instructions;
  if (Array.isArray(obj.data) && obj.data[0]) {
    const d = obj.data[0];
    if (typeof d.instructions === "string") return d.instructions;
    if (typeof d.text === "string") return d.text;
    if (typeof d.content === "string") return d.content;
  }
  return null;
}

async function fetchPromptFromDashboard(apiKey: string, promptId: string): Promise<string | null> {
  // לא מובטח רשמית, אבל ננסה:
  const url = `https://api.openai.com/v1/prompts/${encodeURIComponent(promptId)}`;
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const raw = await r.text();
    let json: AnyJson | null = null;
    try { json = JSON.parse(raw); } catch { /* לא JSON */ }

    if (!r.ok) {
      // נחשוף את מה שקיבלנו כדי להבין מה קרה (יחזור ללקוח כ-json)
      throw new Error(`Failed to fetch prompt: ${r.status} ${r.statusText} — ${raw.slice(0, 400)}`);
    }

    const text = extractPromptText(json);
    return text;
  } catch (e) {
    // אם נכשל—נחזיר null כדי שניפול ל-PROMPT_TEXT
    return null;
  }
}

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

  const PROMPT_ID = process.env.PROMPT_ID || ""; // למשל pmpt_...
  const PROMPT_TEXT_FALLBACK = process.env.PROMPT_TEXT || ""; // אופציונלי, לגיבוי

  try {
    // 1) ננסה להביא מה-Dashboard
    let finalInstructions: string | null = null;
    if (PROMPT_ID) {
      finalInstructions = await fetchPromptFromDashboard(apiKey, PROMPT_ID);
    }

    // 2) Fallback ל-PROMPT_TEXT אם צריך
    if (!finalInstructions) {
      if (PROMPT_TEXT_FALLBACK) {
        finalInstructions = PROMPT_TEXT_FALLBACK;
      } else {
        return new Response(JSON.stringify({
          error: "Unable to load prompt from Dashboard and no PROMPT_TEXT fallback provided.",
          hint: "Add PROMPT_TEXT in Vercel or ensure PROMPT_ID is accessible.",
        }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // 3) יצירת סשן Realtime עם instructions כמחרוזת
    const rt = await fetch("https://api.openai.com/v1/realtime/sessions", {
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
        instructions: finalInstructions,         // ← מחרוזת בלבד
      }),
    });

    const text = await rt.text();
    let json: AnyJson | null = null;
    try { json = JSON.parse(text); } catch { /* לא JSON */ }

    if (!rt.ok) {
      return new Response(JSON.stringify({
        error: "OpenAI Realtime session creation failed",
        status: rt.status,
        details: json ?? text,
      }), { status: rt.status, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      session: json,
      source: (finalInstructions === PROMPT_TEXT_FALLBACK) ? "env_fallback" : "dashboard",
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: String(err),
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
