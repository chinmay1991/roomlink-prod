'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea } from '@roomlink/ui'

/** Staff PRD §11/§12/§13/§16 — Accept/Start/Complete one-tap actions plus an operational note, for a single task. */
export function TaskDetailActions({
  requestId,
  status,
  isMine,
  isUnclaimed,
}: {
  requestId: string
  status: string
  isMine: boolean
  isUnclaimed: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [completeNote, setCompleteNote] = useState('')
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  async function post(path: string, body?: object) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/v1/hotel/requests/${requestId}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong. Please try again.')
      return false
    }
    router.refresh()
    return true
  }

  async function submitNote() {
    if (noteText.trim().length < 2) return
    setSavingNote(true)
    const ok = await post('/note', { note: noteText.trim() })
    setSavingNote(false)
    if (ok) setNoteText('')
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

      {isUnclaimed && (
        <Button className="w-full" disabled={busy} onClick={() => post('/accept')}>
          {busy ? 'Accepting…' : 'Accept Task'}
        </Button>
      )}

      {isMine && status === 'pending_acceptance' && !showReject && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setShowReject(true)}>
            Reject
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => post('/assignment/accept')}>
            {busy ? 'Accepting…' : 'Accept'}
          </Button>
        </div>
      )}

      {isMine && status === 'pending_acceptance' && showReject && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">This sends the request back to reception, unassigned.</p>
          <Textarea
            rows={2}
            placeholder="Why can't you take this on? (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                const ok = await post('/assignment/reject', { reason: rejectReason.trim() || undefined })
                if (ok) setShowReject(false)
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {isMine && status === 'assigned' && (
        <Button className="w-full" disabled={busy} onClick={() => post('/status', { status: 'in_progress' })}>
          {busy ? 'Starting…' : 'Start Task'}
        </Button>
      )}

      {isMine && status === 'in_progress' && !showComplete && (
        <Button className="w-full" onClick={() => setShowComplete(true)}>
          Complete Task
        </Button>
      )}

      {isMine && status === 'in_progress' && showComplete && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <Textarea
            rows={2}
            placeholder="What did you do? (optional)"
            value={completeNote}
            onChange={(e) => setCompleteNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowComplete(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                const ok = await post('/status', { status: 'completed', note: completeNote.trim() || undefined })
                if (ok) setShowComplete(false)
              }}
            >
              Mark Completed
            </Button>
          </div>
        </div>
      )}

      {isMine && (status === 'assigned' || status === 'in_progress') && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label className="block text-xs font-medium text-slate-500">Add a note</label>
          <Textarea
            rows={2}
            placeholder="e.g. Guest requested delivery after 8 PM."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <Button variant="secondary" disabled={savingNote || noteText.trim().length < 2} onClick={submitNote}>
            {savingNote ? 'Saving…' : 'Add Note'}
          </Button>
        </div>
      )}
    </div>
  )
}
