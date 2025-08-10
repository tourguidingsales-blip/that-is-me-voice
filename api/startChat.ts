// /api/startChat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // שרת בלבד

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res.status(500).json({ error: 'Missing required server env vars' });
    }

    // 1) שליפת prompt פעיל מה-DB
    const promptResp = await fetch(
      `${SUPABASE_URL}/rest/v1/prompts?is_active=eq.true&select=instructions`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          Accept: 'application/json',
        },
      }
    );

    if (!promptResp.ok) {
      const raw = await promptResp.text();
      return res.status(500).json({ error: 'Failed to load prompt from DB', raw });
    }

    const rows = (await promptResp.json()) as Array<{ instructions: string }>;
    const instructions = rows?.[0]?.instructions?.trim();
    if (!instructions) return res.status(400).json({ error: 'No active prompt found in DB' });

    // 2) יצירת session אפמרלי ל-Realtime
    const rt = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        turn_detection: { type: 'server_vad' },
      }),
    });

    const rtJson = await rt.json();
    if (!rt.ok) return res.status(rt.status).json({ error: 'OpenAI session error', details: rtJson });

    const { client_secret } = rtJson;
    if (!client_secret) return res.status(500).json({ error: 'No client_secret returned from OpenAI' });

    // 3) נחזיר גם את ההנחיות
    return res.status(200).json({ client_secret, instructions, voice: 'alloy' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Unhandled server error', details: e?.message ?? String(e) });
  }
}
