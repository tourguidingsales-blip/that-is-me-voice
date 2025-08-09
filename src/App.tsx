import React, { useRef, useState } from 'react'
import RealtimeVoiceCard from './components/RealtimeVoiceCard'
import { connectRealtime, disconnectRealtime, RealtimeHandle } from './lib/realtimeClient'
import { initTranscriber, stopTranscriber } from './lib/transcriber'

export default function App() {
  const handleRef = useRef<RealtimeHandle | null>(null)
  const [status, setStatus] = useState<'idle'|'connecting'|'connected'|'stopped'|'error'>('idle')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant'; content:string}>>([])

  async function startChat() {
    setStatus('connecting')
    // 1) לבקש סשן + conversationId מהשרת
    const res = await fetch('/api/startChat', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'startChat failed')

    const session = data.session
    setConversationId(data.conversationId || null)

    // 2) להתחבר ל-Realtime דרך WebRTC
    handleRef.current = await connectRealtime({
      clientSecret: session?.client_secret?.value,
      onAssistantText: (chunk) => setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          last.content += chunk
          return [...prev.slice(0, -1), last]
        }
        return [...prev, { role: 'assistant', content: chunk }]
      }),
      onConnected: () => setStatus('connected'),
      onDisconnected: () => setStatus('stopped'),
      onError: () => setStatus('error'),
    })

    // 3) לאתחל תמלול משתמש (VAD פשוט) ולשלוח תוצאות ל-state
    initTranscriber({
      onUserText: (text) => setMessages(prev => [...prev, { role: 'user', content: text }])
    })
  }

  async function stopChat() {
    stopTranscriber()
    await disconnectRealtime(handleRef.current)

    // 4) לשמור את התמלול ל-Supabase
    if (conversationId) {
      await fetch('/api/saveTranscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messages, end: true })
      })
    }
    setStatus('stopped')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <RealtimeVoiceCard onStart={startChat} onStop={stopChat} status={status} />
    </div>
  )
}
