import { NextRequest } from "next/server";
export const config = { runtime: "edge" };

type Message = { role: 'user'|'assistant'; content: string; start_ms?: number; end_ms?: number };

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

  try {
    const body = await req.json() as { conversationId: string; messages: Message[]; end?: boolean };
    const { conversationId, messages, end } = body || {};

    console.log("saveTranscript payload", {
      conversationIdExists: Boolean(conversationId),
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      end
    });

    if (!conversationId || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ ok:false, where:"validate", detail:"missing conversationId or messages" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
      console.log("insert messages status", insertRes.status);

      if (!insertRes.ok) {
        const t = await insertRes.text();
        console.error("supabase insert error", t);
        return new Response(
          JSON.stringify({ ok:false, where:"insert messages", detail:t }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (end) {
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ended_at: new Date().toISOString() })
      });
      console.log("patch conversation status", patchRes.status);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error("saveTranscript exception", e?.message || e);
    return new Response(
      JSON.stringify({ ok:false, where:"exception", detail: String(e?.message || e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
