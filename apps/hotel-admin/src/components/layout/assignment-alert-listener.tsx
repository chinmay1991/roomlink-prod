'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { Button, Modal, StatusBadge, Textarea, timeAgo } from '@roomlink/ui'

type PendingAssignment = {
  request_id: string
  request_type: string
  priority: string
  notes: string | null
  created_at: string
  rooms: { room_number: string } | null
  departments: { name: string } | null
}

const POLL_INTERVAL_MS = 4000
const REPEAT_ALERT_MS = 10000

async function fetchPendingAssignments(): Promise<PendingAssignment[]> {
  const res = await fetch('/api/v1/hotel/requests/pending-assignments')
  if (!res.ok) throw new Error(`Failed to fetch pending assignments (${res.status})`)
  return res.json()
}

/** Same synthesized-tone approach as reception-alert-listener.tsx's playChime — a slightly lower, single-note ping (distinct from that chime and from the voice-call Ringtone) so a staff member can tell "new task" apart from either at a glance without looking at the screen. */
function playAssignmentTone() {
  const ctx = new AudioContext()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 587.33
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.55)
  setTimeout(() => ctx.close().catch(() => {}), 900)
}

/**
 * Mounted once at the hotel portal layout level (hotel/layout.tsx), same
 * spot as ReceptionAlertListener/VoiceCallListener, for Department Manager/
 * Staff sessions. Polls the same lightweight-signal pattern (no
 * websocket/SSE infra — see polling-refresh.tsx) but renders a *modal*, not
 * a dismissible banner: the whole point of this alert is that reception
 * assigned specific work to this person and needs a response, so it stays
 * up — with a repeating tone, not just a one-shot chime — until they accept
 * or reject. Multiple simultaneous hand-offs queue; the oldest shows first
 * and the tone keeps repeating as long as anything is still queued.
 */
export function AssignmentAlertListener({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const seenIdsRef = useRef<Set<string> | null>(null)
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [queue, setQueue] = useState<PendingAssignment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const stopRepeating = useCallback(() => {
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current)
    repeatTimerRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function poll() {
      const assignments = await fetchPendingAssignments().catch((error) => {
        console.error('[assignment-alert-listener] poll failed', error)
        return null
      })
      if (!assignments || cancelled) return

      const currentIds = new Set(assignments.map((a) => a.request_id))
      const hasNewArrival = seenIdsRef.current !== null && assignments.some((a) => !seenIdsRef.current!.has(a.request_id))
      const isFirstPoll = seenIdsRef.current === null
      seenIdsRef.current = currentIds

      setQueue(assignments)

      if (assignments.length === 0) {
        stopRepeating()
        return
      }

      // A brand-new arrival (or the very first poll finding one already
      // waiting, e.g. this tab opened after the assignment happened) gets an
      // immediate tone; either way, start the repeat loop so it can't be missed.
      if (hasNewArrival || isFirstPoll) playAssignmentTone()
      if (!repeatTimerRef.current) {
        repeatTimerRef.current = setInterval(playAssignmentTone, REPEAT_ALERT_MS)
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
      stopRepeating()
    }
  }, [enabled, stopRepeating])

  async function respond(path: 'accept' | 'reject', requestId: string, body?: object) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/v1/hotel/requests/${requestId}/assignment/${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong. Please try again.')
      return
    }
    setQueue((prev) => prev.filter((a) => a.request_id !== requestId))
    seenIdsRef.current?.delete(requestId)
    setShowReject(false)
    setRejectReason('')
    setError(null)
    router.refresh()
  }

  if (queue.length === 0) return null

  const current = queue[0]!

  return (
    <Modal title="New task assigned to you" onClose={() => {}}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <ClipboardList className="h-4.5 w-4.5 text-blue-700" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Room {current.rooms?.room_number ?? '—'}
              {current.departments && <span className="font-normal text-slate-500"> · {current.departments.name}</span>}
            </p>
            <p className="mt-0.5 text-sm text-slate-700">{current.request_type}</p>
            {current.notes && <p className="mt-1 text-xs text-slate-500">{current.notes}</p>}
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={current.priority} />
              <span className="text-xs text-slate-400">{timeAgo(current.created_at)}</span>
            </div>
          </div>
        </div>

        {queue.length > 1 && <p className="text-xs text-slate-500">+{queue.length - 1} more waiting on your response</p>}

        {error && <p className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

        {!showReject ? (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setShowReject(true)}>
              Reject
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => respond('accept', current.request_id)}>
              {busy ? 'Accepting…' : 'Accept'}
            </Button>
          </div>
        ) : (
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
                Back
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={busy}
                onClick={() => respond('reject', current.request_id, { reason: rejectReason.trim() || undefined })}
              >
                {busy ? 'Rejecting…' : 'Confirm reject'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
