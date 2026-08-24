'use client'

import { useEffect, useRef, useState } from 'react'
import { PhoneIncoming, PhoneOff } from 'lucide-react'
import { Button, Modal } from '@roomlink/ui'
import type { ZegoUIKitPrebuilt as ZegoUIKitPrebuiltClass } from '@zegocloud/zego-uikit-prebuilt'

type VoiceCallToken = { appId: number; token: string; userId: string; userName: string }
type IncomingCall = { roomNumber: string | null; guestName: string | null; accept: () => void; refuse: () => void }

/**
 * The guest client JSON.stringifies { roomNumber, guestName } into
 * sendCallInvitation's `data` param (apps/guest's voice-call-button.tsx) —
 * this is the primary channel for room details. `callerName` (the SDK's own
 * plain-text userName field, e.g. "Room 204 (Jane Doe)") is a fallback only,
 * used if `data` is ever missing or fails to parse.
 */
function parseCallInviteData(data: string, callerName: string): { roomNumber: string | null; guestName: string | null } {
  try {
    const parsed = JSON.parse(data)
    if (typeof parsed.roomNumber === 'string') {
      return { roomNumber: parsed.roomNumber, guestName: typeof parsed.guestName === 'string' ? parsed.guestName : null }
    }
  } catch {
    // fall through to the caller-name fallback below
  }
  return { roomNumber: callerName || null, guestName: null }
}

async function fetchListenerToken(): Promise<VoiceCallToken> {
  const res = await fetch('/api/v1/hotel/voice-call/token')
  if (!res.ok) throw new Error(`Failed to fetch voice-call token (${res.status})`)
  return res.json()
}

/**
 * Synthesized two-tone ring (Web Audio API), not an external audio file —
 * no asset to host/license, works offline. Loops every 2s until stop().
 */
class Ringtone {
  private ctx: AudioContext | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null

  start() {
    if (this.intervalId) return
    this.ctx = new AudioContext()
    const ring = () => {
      const ctx = this.ctx
      if (!ctx) return
      const now = ctx.currentTime
      for (const freq of [440, 480]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.9)
      }
    }
    ring()
    this.intervalId = setInterval(ring, 2000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}

/**
 * Mounted once at the hotel portal layout level (hotel/layout.tsx), for
 * both the desktop browser and the Capacitor-wrapped native shell — not
 * only MobileShell, since desktop Front Office also needs to receive calls.
 * `enabled` is Front-Office-role only, mirroring who apps/guest's
 * startVoiceCall actually invites — a guest call rings the front desk and
 * nowhere else, so every other role (including hotel_admin) never touches
 * ZegoCloud at all.
 *
 * v1 is foreground-only by design (see the voice calling plan): this only
 * rings while this component is mounted and the tab/app is open.
 * Background/killed-app ringing is an explicit, separate future phase that
 * needs a real Firebase project + Apple APNs key, which don't exist yet
 * (same blocker already noted on the existing push.ts stub).
 *
 * Renders its own popup + ringtone (enableCustomCallInvitationDialog) rather
 * than relying on the SDK's built-in incoming-call banner, so it's
 * unmistakable and independent of that banner's own visibility/z-index
 * behavior. Wired against ZegoCloud's documented Call Invitation API and its
 * shipped .d.ts (node_modules/@zegocloud/zego-uikit-prebuilt/index.d.ts).
 *
 * The SDK is a multi-MB WebRTC bundle, loaded via dynamic import() rather
 * than a static one — this component is mounted for every /hotel/* page
 * (layout-level), and a static import would ship that bundle to every
 * staff role, not just the Front Office/admin users who ever use it.
 */
export function VoiceCallListener({ enabled }: { enabled: boolean }) {
  // Zego's callID and call_logs.zego_room_id are the same value (the guest
  // sets both via sendCallInvitation's explicit roomID param) — this is
  // what /answer and /decline are keyed on, since this client never learns
  // our internal call_log_id.
  const activeZegoRoomIdRef = useRef<string | null>(null)
  const ringtoneRef = useRef<Ringtone | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)

  function stopRinging() {
    ringtoneRef.current?.stop()
    setIncomingCall(null)
  }

  useEffect(() => {
    if (!enabled) return

    const ringtone = new Ringtone()
    ringtoneRef.current = ringtone

    let zp: ZegoUIKitPrebuiltClass | null = null
    let cancelled = false

    async function init() {
      const [{ ZegoUIKitPrebuilt }, { ZIM }, { appId, token, userId, userName }] = await Promise.all([
        import('@zegocloud/zego-uikit-prebuilt'),
        import('zego-zim-web'),
        fetchListenerToken(),
      ])
      if (cancelled) return

      // '' roomID — this is a listener login only, not tied to any one call
      // yet (mirrors ZegoCloud's own call-invitation quick start, which
      // passes null/'' here for the same reason).
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(appId, token, '', userId, userName)
      zp = ZegoUIKitPrebuilt.create(kitToken)
      zp.addPlugins({ ZIM })

      zp.setCallInvitationConfig({
        enableCustomCallInvitationDialog: true,
        // Undocumented SDK coupling (traced in the shipped
        // zego-uikit-prebuilt bundle, v2.18.2): when a participant hangs up
        // mid-call, the local endCall(LeaveRoom) handler only sends the ZIM
        // callEnd/callQuit signal that notifies the other side if
        // canInvitingInCalling is true. Without it, hanging up only tears
        // down the local UI — the other party's call never ends. Neither
        // app exposes any in-call "invite more people" UI, so this flag's
        // documented purpose (allowing mid-call invitations) has no visible
        // effect here; it's set purely to unlock the hangup-propagation path.
        canInvitingInCalling: true,
        onIncomingCallReceived: (callID) => {
          activeZegoRoomIdRef.current = callID
        },
        onIncomingCallCanceled: () => {
          activeZegoRoomIdRef.current = null
          stopRinging()
        },
        onIncomingCallTimeout: () => {
          activeZegoRoomIdRef.current = null
          stopRinging()
        },
        onCallInvitationEnded: () => {
          activeZegoRoomIdRef.current = null
          stopRinging()
        },
        // Custom dialog: we own the popup + ringtone instead of the SDK's
        // built-in banner. `accept`/`refuse` are the SDK's own callbacks —
        // calling accept() still triggers its internal join flow below.
        onConfirmDialogWhenReceiving: (_callType, caller, refuse, accept, data) => {
          ringtone.start()
          const { roomNumber, guestName } = parseCallInviteData(data, caller.userName ?? '')
          setIncomingCall({
            roomNumber,
            guestName,
            accept: () => {
              stopRinging()
              accept()
            },
            refuse: () => {
              stopRinging()
              refuse()
            },
          })
        },
        // Fires only when *this* client is about to join a room from the
        // invitation flow — for this listener (staff never initiates calls
        // here) that only ever means "I just pressed Accept". This is how
        // our own history/missed-call tracking learns who answered.
        // Fire-and-forget: this callback must return synchronously.
        onSetRoomConfigBeforeJoining: () => {
          const zegoRoomId = activeZegoRoomIdRef.current
          if (zegoRoomId) {
            fetch(`/api/v1/hotel/voice-call/${zegoRoomId}/answer`, { method: 'POST' }).catch((error) =>
              console.error('[voice-call] failed to record answer', error),
            )
          }
          return {
            scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
            turnOnCameraWhenJoining: false,
            showMyCameraToggleButton: false,
            showAudioVideoSettingsButton: false,
            showScreenSharingButton: false,
            showTextChat: false,
            showUserList: false,
          }
        },
        // TODO: token TTL is 1h (voice-call.service.ts's LISTENER_TOKEN_TTL_SECONDS).
        // ZegoUIKitPrebuilt.renewToken()'s exact re-fetch contract needs
        // confirming against a live project before relying on it; for now
        // this only logs so a long-open Front Office tab doesn't fail silently.
        onTokenWillExpire: () => {
          console.warn('[voice-call] listener token is about to expire — not yet renewed automatically')
        },
      })
    }

    init().catch((error) => console.error('[voice-call] listener init failed', error))

    return () => {
      cancelled = true
      ringtone.stop()
      zp?.destroy()
    }
  }, [enabled])

  if (!incomingCall) return null

  return (
    <Modal title="Incoming call" onClose={incomingCall.refuse}>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <PhoneIncoming className="h-6 w-6 text-emerald-600" aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {incomingCall.roomNumber ? `Room ${incomingCall.roomNumber}` : 'A guest'}
            </span>{' '}
            is calling Front Office
          </p>
          {incomingCall.guestName && <p className="mt-0.5 text-xs text-slate-500">{incomingCall.guestName}</p>}
        </div>
        <div className="flex w-full gap-3">
          <Button variant="danger" onClick={incomingCall.refuse} className="flex-1">
            <PhoneOff className="h-4 w-4" aria-hidden />
            Decline
          </Button>
          <Button onClick={incomingCall.accept} className="flex-1">
            <PhoneIncoming className="h-4 w-4" aria-hidden />
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  )
}
