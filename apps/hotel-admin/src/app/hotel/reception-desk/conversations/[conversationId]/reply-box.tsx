'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea } from '@roomlink/ui'

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (content.trim().length === 0) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/v1/hotel/conversations/${conversationId}/messages`, {
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
    <div className="space-y-2">
      {error && <p className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}
      <Textarea
        rows={2}
        placeholder="Reply to the guest…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />
      <div className="flex justify-end">
        <Button disabled={busy || content.trim().length === 0} onClick={send}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
