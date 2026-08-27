'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { Button } from '@roomlink/ui'
import type { ZegoUIKitPrebuilt as ZegoUIKitPrebuiltClass } from '@zegocloud/zego-uikit-prebuilt'

type CallState = 'idle' | 'starting' | 'ringing' | 'connected'

type StartVoiceCallResponse = {
  callLogId: string
  appId: number
  token: string
  userId: string
  userName: string
  roomId: string
  roomNumber: string
  guestName: string | null
  calleeIds: string[]
}

async function endCallOnServer(callLogId: string) {
  await fetch(`/api/guest/voice-call/${callLogId}/end`, { method: 'POST' }).catch((error) =>
    console.error('[voice-call] failed to record hangup', error),
  )
}

/**
 * "Call Reception" — guest side of the ZegoCloud voice calling feature.
 * Rings every Reception/admin staff member at this hotel at once (v1 has
 * no "on duty" concept — see the voice calling plan); first to accept gets
 * the call. Foreground-only: this only works while this page is open.
 *
 * Wired against ZegoCloud's documented Call Invitation API and its shipped
 * .d.ts (node_modules/@zegocloud/zego-uikit-prebuilt/index.d.ts), mirroring
 * apps/hotel-admin's voice-call-listener.tsx on the callee side — but not
 * yet verified against a live two-browser call with a real ZegoCloud
 * project. Confirm end to end before shipping.
 *
 * The SDK is a multi-MB WebRTC bundle, loaded via dynamic import() rather
 * than a static one, so it only downloads once a guest actually taps "Call
 * Reception" instead of on every load of this page.
 */
export function VoiceCallButton() {
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const zpRef = useRef<ZegoUIKitPrebuiltClass | null>(null)
  const callLogIdRef = useRef<string | null>(null)
  const endedRef = useRef(false)

  // Stable across renders (only touches refs/setState) so the unmount
  // effect below can safely depend on it without going stale.
  const endCall = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    if (callLogIdRef.current) endCallOnServer(callLogIdRef.current)
    zpRef.current?.destroy()
    zpRef.current = null
    callLogIdRef.current = null
    setState('idle')
  }, [])

  useEffect(() => () => endCall(), [endCall])

  async function startCall() {
    setError(null)
    setState('starting')
    endedRef.current = false

    const res = await fetch('/api/guest/voice-call/start', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Unable to reach Reception. Please try again.')
      setState('idle')
      return
    }

    const call: StartVoiceCallResponse = await res.json()
    callLogIdRef.current = call.callLogId

    if (call.calleeIds.length === 0) {
      setError('No one at Reception is available right now. Please try again shortly.')
      endCall()
      return
    }

    const [{ ZegoUIKitPrebuilt }, { ZIM }] = await Promise.all([
      import('@zegocloud/zego-uikit-prebuilt'),
      import('zego-zim-web'),
    ])

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
      call.appId,
      call.token,
      call.roomId,
      call.userId,
      call.userName,
    )
    const zp = ZegoUIKitPrebuilt.create(kitToken)
    zpRef.current = zp
    zp.addPlugins({ ZIM })

    zp.setCallInvitationConfig({
      // Undocumented SDK coupling (traced in the shipped
      // zego-uikit-prebuilt bundle, v2.18.2): when a participant hangs up
      // mid-call, the local endCall(LeaveRoom) handler only sends the ZIM
      // callEnd/callQuit signal that notifies the other side if
      // canInvitingInCalling is true. Without it, hanging up only tears
      // down the local UI — the other party's call never ends. Neither app
      // exposes any in-call "invite more people" UI, so this flag's
      // documented purpose (allowing mid-call invitations) has no visible
      // effect here; it's set purely to unlock the hangup-propagation path.
      canInvitingInCalling: true,
      onOutgoingCallAccepted: () => setState('connected'),
      onOutgoingCallRejected: () => {
        setError('Reception declined the call.')
        endCall()
      },
      onOutgoingCallDeclined: () => {
        setError('Reception declined the call.')
        endCall()
      },
      onOutgoingCallTimeout: () => {
        setError('No one answered. Please try again.')
        endCall()
      },
      onCallInvitationEnded: () => endCall(),
      onSetRoomConfigBeforeJoining: () => ({
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        turnOnCameraWhenJoining: false,
        showMyCameraToggleButton: false,
        showAudioVideoSettingsButton: false,
        showScreenSharingButton: false,
        showTextChat: false,
        showUserList: false,
      }),
    })

    // addPlugins() kicks off ZIM login asynchronously; calling
    // sendCallInvitation() in the same tick can race ahead of that login
    // actually completing. Confirmed via a live test: the SDK throws
    // {code: 6000121, message: "API.callInvite: Not logged in."} — a hard
    // throw, not just a soft errorInvitees failure — even though both
    // sides show "online" moments later via ZegoCloud's own
    // QueryUserOnlineState API. There's no "login ready" hook exposed on
    // this SDK's typed surface, so retry both failure shapes (thrown and
    // errorInvitees) with a short delay until login has had time to settle.
    const MAX_INVITE_ATTEMPTS = 5
    const INVITE_RETRY_DELAY_MS = 1000

    // Room number/guest name for Reception's incoming-call popup — sent as
    // the invitation's `data` payload (delivered verbatim to
    // onConfirmDialogWhenReceiving on the callee side) rather than crammed
    // into `userName`, which is also set as a plain-text fallback above.
    const callInviteData = JSON.stringify({ roomNumber: call.roomNumber, guestName: call.guestName })

    async function attemptInvite() {
      return zp.sendCallInvitation({
        callees: call.calleeIds.map((id) => ({ userID: id, userName: 'Reception' })),
        callType: ZegoUIKitPrebuilt.InvitationTypeVoiceCall,
        timeout: 60,
        roomID: call.roomId,
        data: callInviteData,
      })
    }

    let succeeded = false
    for (let attempt = 1; attempt <= MAX_INVITE_ATTEMPTS; attempt++) {
      try {
        const result = await attemptInvite()
        if (result.errorInvitees.length < call.calleeIds.length) {
          succeeded = true
          break
        }
        console.warn(`[voice-call] sendCallInvitation attempt ${attempt}: all invitees failed`, result.errorInvitees)
      } catch (error) {
        console.warn(`[voice-call] sendCallInvitation attempt ${attempt} threw`, error)
      }
      if (attempt < MAX_INVITE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, INVITE_RETRY_DELAY_MS))
      }
    }

    if (!succeeded) {
      console.error('[voice-call] sendCallInvitation failed after', MAX_INVITE_ATTEMPTS, 'attempts')
      setError('Unable to reach Reception. Please try again.')
      endCall()
      return
    }

    setState('ringing')
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

      {state === 'idle' && (
        <Button onClick={startCall} className="w-full">
          <Phone className="h-4 w-4" aria-hidden />
          Call Reception
        </Button>
      )}

      {state === 'starting' && (
        <Button disabled className="w-full">
          <Phone className="h-4 w-4" aria-hidden />
          Connecting…
        </Button>
      )}

      {state === 'ringing' && (
        <Button variant="danger" onClick={endCall} className="w-full">
          <PhoneOff className="h-4 w-4" aria-hidden />
          Ringing Reception… tap to cancel
        </Button>
      )}

      {state === 'connected' && (
        <Button variant="danger" onClick={endCall} className="w-full">
          <PhoneOff className="h-4 w-4" aria-hidden />
          On call with Reception — tap to hang up
        </Button>
      )}
    </div>
  )
}
