'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea, timeAgo, cn } from '@roomlink/ui'

type Message = { message_id: string; sender_type: string; content: string; sent_at: string }

export function MessageThread({ initialMessages }: { initialMessages: Message[] }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [initialMessages.length])

  async function send() {
    if (content.trim().length === 0) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/guest/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim() }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Unable to send. Please try again.')
      return
    }
    setContent('')
    router.refresh()
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {initialMessages.map((m) => (
          <div key={m.message_id} className={cn('max-w-[80%]', m.sender_type === 'guest' ? 'ml-auto text-right' : '')}>
            <p
              className={cn(
                'inline-block rounded-lg px-3.5 py-2 text-sm',
                m.sender_type === 'guest' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
              )}
            >
              {m.content}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{m.sender_type === 'guest' ? 'You' : 'Front Office'} · {timeAgo(m.sent_at)}</p>
          </div>
        ))}
        {initialMessages.length === 0 && (
          <p className="pt-10 text-center text-sm text-slate-500">Send a message to start a conversation with Front Office.</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <Textarea
          rows={1}
          className="flex-1"
          placeholder="Type a message…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button disabled={busy || content.trim().length === 0} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  )
}
