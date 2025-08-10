// api/startChat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY in environment variables' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse',
        // כאן אנחנו משתמשים בפרומפט מהדשבורד
        instructions: undefined, // אין טקסט קוד קשיח
        prompt_id: 'pmpt_689444b883a881959f896126cb070b630eed2a5504096065',
      }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      console.error('OpenAI API error:', data || await r.text());
      return res.status(r.status).json({
        error: 'OpenAI API request failed',
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
