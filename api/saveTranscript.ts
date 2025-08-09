import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

type Message = { role: 'user'|'assistant'; content: string; start_ms?: number; end_ms?: number };

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

  try {
    const { conversationId, messages, end } = await req.json() as { conversationId: string; messages: Message[]; end?: boolean };
    if (!conversationId || !Array.isArray(messages)) return new Response('bad payload', { status: 400 });

    if (messages.length) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages.map(m => ({ conversation_id: conversationId, ...m })))
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
    }

    if (end) {
      await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ended_at: new Date().toISOString() })
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
