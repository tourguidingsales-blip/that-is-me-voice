// pages/api/startChat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!; // עדיף SR, לא anon

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) throw new Error('Missing Supabase envs');

    // 1) שליפת ה-prompt הפעיל מה-Supabase
    const promptResp = await fetch(
      `${SUPABASE_URL}/rest/v1/prompts?is_active=eq.true&select=instructions&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!promptResp.ok) {
      const text = await promptResp.text();
      throw new Error(`Failed to fetch prompt from Supabase: ${promptResp.status} ${text}`);
    }

    const prompts = (await promptResp.json()) as Array<{ instructions: string }>;
    const instructions = prompts?.[0]?.instructions ?? '';

    // 2) יצירת אפמרל-טוקן ל-Realtime
    const rtResp = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        modalities: ['audio'],
        // אפשר גם turn_detection כאן אם תרצה כבר ברמת הסשן
        // turn_detection: { type: 'server_vad' }
      }),
    });

    const data = await rtResp.json();

    if (!rtResp.ok) {
      // משיבים את השגיאה כדי שתופיע בריצה בלוגים
      return res.status(500).json({ error: 'OpenAI session failed', details: data });
    }

    // 3) מחזירים בדיוק את מה שה-UI מצפה
    return res.status(200).json({
      client_secret: data.client_secret, // בד"כ { value: '...' }
      instructions,
      voice: 'alloy',
    });
  } catch (err: any) {
    console.error('startChat error:', err);
    return res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}
