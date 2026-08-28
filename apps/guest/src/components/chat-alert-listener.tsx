'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquareText, X } from 'lucide-react'

type Signal = { latestStaffMessageId: string | null; preview: string | null }

const POLL_INTERVAL_MS = 3000
const BANNER_AUTO_DISMISS_MS = POLL_INTERVAL_MS

async function fetchSignal(): Promise<Signal> {
  const res = await fetch('/api/guest/messages-signal')
  if (!res.ok) throw new Error(`Failed to fetch messages signal (${res.status})`)
  return res.json()
}

/** One-shot ascending chime (Web Audio API) — same technique as hotel-admin's reception-alert-listener, no audio asset needed. */
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
 * Mounted once at the guest app's shared layout ((app)/layout.tsx), so a
 * guest gets the alert on whichever page they're on, not only while the
 * Reception chat thread is open.
 *
 * No websocket/SSE infra exists in this codebase — this follows the same
 * "minimum reliable polling" approach used on the hotel-admin side
 * (reception-alert-listener.tsx), tracking the newest staff-sent message's
 * id (not a count/has-unread flag) so a reply is never missed between polls.
 *
 * Foreground-only by design, same tradeoff already made elsewhere (voice
 * calls, the reception listener): only fires while this tab is open.
 */
export function ChatAlertListener() {
  const router = useRouter()
  const lastSeenIdRef = useRef<string | null | undefined>(undefined)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [alert, setAlert] = useState<{ preview: string | null } | null>(null)

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    setAlert(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    function fire(next: { preview: string | null }) {
      playChime()
      setAlert(next)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(dismiss, BANNER_AUTO_DISMISS_MS)
      router.refresh()
    }

    async function poll() {
      const signal = await fetchSignal().catch((error) => {
        console.error('[chat-alert-listener] poll failed', error)
        return null
      })
      if (!signal || cancelled) return

      // First poll after mount just establishes a baseline — nothing to
      // compare against yet, so it must never alert.
      const isNew = lastSeenIdRef.current !== undefined && signal.latestStaffMessageId !== lastSeenIdRef.current
      lastSeenIdRef.current = signal.latestStaffMessageId

      if (isNew) fire({ preview: signal.preview })
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [router, dismiss])

  if (!alert) return null

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm">
      <button
        type="button"
        onClick={() => {
          dismiss()
          router.push('/reception')
        }}
        className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-lg ring-1 ring-black/5 hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <MessageSquareText className="h-4.5 w-4.5 text-blue-700" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">New message from Reception</span>
          {alert.preview && <span className="mt-0.5 block truncate text-sm text-slate-600">{alert.preview}</span>}
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
