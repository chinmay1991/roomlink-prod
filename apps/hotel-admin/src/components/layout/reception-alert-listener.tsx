'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, MessageSquareText, X } from 'lucide-react'

type Signal = {
  latestRequestId: string | null
  requestType: string | null
  priority: string | null
  roomNumber: string | null
  latestGuestMessageId: string | null
  latestGuestMessageConversationId: string | null
  latestGuestMessageRoomNumber: string | null
}

type Alert =
  | { kind: 'request'; roomNumber: string | null; requestType: string | null }
  | { kind: 'message'; roomNumber: string | null; conversationId: string }

const POLL_INTERVAL_MS = 3000
const BANNER_AUTO_DISMISS_MS = POLL_INTERVAL_MS

async function fetchSignal(): Promise<Signal> {
  const res = await fetch('/api/v1/hotel/reception/live-signal')
  if (!res.ok) throw new Error(`Failed to fetch reception live signal (${res.status})`)
  return res.json()
}

/** One-shot ascending chime (Web Audio API) — distinct from the voice-call Ringtone, which loops. */
function playChime() {
  const ctx = new AudioContext()
  const now = ctx.currentTime
  const notes = [523.25, 659.25]
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = notes[i]
    const start = now + i * 0.12
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.4)
  }
  setTimeout(() => ctx.close().catch(() => {}), 900)
}

/**
 * Mounted once at the hotel portal layout level (hotel/layout.tsx), same
 * place as VoiceCallListener, so Reception/hotel_admin get the alert no
 * matter which /hotel/* page they're on — not just the dashboard.
 *
 * No websocket/SSE infra exists in this codebase (see polling-refresh.tsx),
 * so this follows the same "minimum reliable polling" approach, just on a
 * tighter interval than the 20s dashboard refresh since it backs an audible
 * alert. Tracks the newest request's id and the newest guest-sent message's
 * id separately (not counts) so either one changing state between two polls
 * still triggers exactly one chime.
 *
 * Foreground-only by design, same tradeoff already made for voice calls:
 * this only fires while the tab is open and this component mounted.
 */
export function ReceptionAlertListener({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const lastSeenRequestIdRef = useRef<string | null | undefined>(undefined)
  const lastSeenMessageIdRef = useRef<string | null | undefined>(undefined)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [alert, setAlert] = useState<Alert | null>(null)

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    setAlert(null)
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    function fire(next: Alert) {
      playChime()
      setAlert(next)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(dismiss, BANNER_AUTO_DISMISS_MS)
      router.refresh()
    }

    async function poll() {
      const signal = await fetchSignal().catch((error) => {
        console.error('[reception-alert-listener] poll failed', error)
        return null
      })
      if (!signal || cancelled) return

      // First poll after mount just establishes a baseline for each signal —
      // nothing to compare against yet, so neither must alert.
      const isNewRequest = lastSeenRequestIdRef.current !== undefined && signal.latestRequestId !== lastSeenRequestIdRef.current
      const isNewMessage =
        lastSeenMessageIdRef.current !== undefined && signal.latestGuestMessageId !== lastSeenMessageIdRef.current

      lastSeenRequestIdRef.current = signal.latestRequestId
      lastSeenMessageIdRef.current = signal.latestGuestMessageId

      // A request arriving takes priority when both change in the same poll
      // window; the chime already fired either way, and the message will
      // still be there (and unread) on the next poll if it gets dropped here.
      if (isNewRequest) {
        fire({ kind: 'request', roomNumber: signal.roomNumber, requestType: signal.requestType })
      } else if (isNewMessage && signal.latestGuestMessageConversationId) {
        fire({ kind: 'message', roomNumber: signal.latestGuestMessageRoomNumber, conversationId: signal.latestGuestMessageConversationId })
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [enabled, router, dismiss])

  if (!alert) return null

  const href = alert.kind === 'request' ? '/hotel/requests?status=pending' : `/hotel/reception-desk/conversations/${alert.conversationId}`

  return (
    <div className="fixed right-4 top-4 z-50 w-full max-w-sm">
      <button
        type="button"
        onClick={() => {
          dismiss()
          router.push(href)
        }}
        className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-lg ring-1 ring-black/5 hover:bg-slate-50"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${alert.kind === 'request' ? 'bg-green-100' : 'bg-blue-100'}`}>
          {alert.kind === 'request' ? (
            <ClipboardList className="h-4.5 w-4.5 text-green-700" aria-hidden />
          ) : (
            <MessageSquareText className="h-4.5 w-4.5 text-blue-700" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{alert.kind === 'request' ? 'New request' : 'New message'}</span>
          <span className="mt-0.5 block truncate text-sm text-slate-600">
            {alert.kind === 'request' ? alert.requestType ?? 'Request' : 'From guest'}
            {alert.roomNumber ? ` — Room ${alert.roomNumber}` : ''}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            dismiss()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              dismiss()
            }
          }}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </span>
      </button>
    </div>
  )
}
