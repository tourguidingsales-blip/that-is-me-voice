import React, { useRef, useState } from 'react'
import RealtimeVoiceCard from './components/RealtimeVoiceCard'
import { connectRealtime, disconnectRealtime, RealtimeHandle } from './lib/realtimeClient'
import { initTranscriber, stopTranscriber } from './lib/transcriber'

type Turn = { role: 'user' | 'assistant'; content: string; start_ms?: number; end_ms?: number }

export default function App() {
  const handleRef = useRef<RealtimeHandle | null>(null)
  const [status, setStatus] = useState<'idle'|'connecting'|'connected'|'stopped'|'error'>('idle')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Turn[]>([])

  // שמירה מידית של מקטעים בודדים (לשימור "תוך כדי")
  async function saveNow(partial: Turn[]) {
    if (!conversationId || partial.length === 0) return
    try {
      await fetch('/api/saveTranscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messages: partial, end: false }),
      })
    } catch (e) {
      console.warn('saveNow failed', e)
    }
  }

  async function startChat() {
    setStatus('connecting')

    // 1) בקשת סשן Realtime ושיחה חדשה לוגית
    const res = await fetch('/api/startChat', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'startChat failed')

    setConversationId(data?.conversationId || null)

    // 2) חיבור ל-Realtime (טקסט של העוזרת יישמר תוך כדי)
    handleRef.current = await connectRealtime({
      clientSecret: data?.session?.client_secret?.value,
      onAssistantText: (chunk: string) => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            last.content += chunk
          } else {
            next.push({ role: 'assistant', content: chunk })
          }
          const lastTurn = next[next.length - 1]
          saveNow([lastTurn]) // שמירה מיידית
          return next
        })
      },
      onConnected: () => setStatus('connected'),
      onDisconnected: () => setStatus('stopped'),
      onError: () => setStatus('error'),
    })

    // 3) תמלול קלט משתמש ושמירה מיידית
    initTranscriber({
      onUserText: (text: string) => {
        setMessages(prev => {
          const turn = { role: 'user', content: text || '(לא נתפס דיבור)' } as Turn
          saveNow([turn])
          return [...prev, turn]
        })
      }
    })
  }

  async function stopChat() {
    stopTranscriber()
    await disconnectRealtime(handleRef.current)

    // 4) שמירה מרוכזת בסיום
    if (conversationId && messages.length) {
      try {
        await fetch('/api/saveTranscript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, messages, end: true }),
        })
      } catch (e) {
        console.warn('final save failed', e)
      }
    }
    setStatus('stopped')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <RealtimeVoiceCard onStart={startChat} onStop={stopChat} status={status} />
    </div>
  )
}
