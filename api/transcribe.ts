import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  try {
    const form = await req.formData();
    const audio = form.get('audio') as File;
    if (!audio) return new Response('missing audio', { status: 400 });

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: (() => {
        const fd = new FormData();
        fd.append('file', audio, 'u.webm');
        fd.append('model', 'gpt-4o-mini-transcribe'); // עדכן לפי המודלים הזמינים לך
        fd.append('response_format', 'json');
        return fd;
      })(),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const text = data.text ?? data?.results?.[0]?.text ?? '';
    return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
