import { prisma } from '@/server/db'
import { generateZegoToken, getZegoAppId, shortZegoId } from '@/server/zego-token'
import { InvalidTransitionError } from '@/server/errors'
import { requireReceptionOrAdmin } from './reception.service'
import type { HotelSessionUser } from '@/server/require-hotel-session'

const LISTENER_TOKEN_TTL_SECONDS = 3600
const ANSWER_TOKEN_TTL_SECONDS = 600

/** Must derive the same id apps/guest's staffZegoUserId does for the same user_id — that's what makes a guest's call invitation reach this staff member's own login. */
export function staffZegoUserId(userId: string): string {
  return shortZegoId('s', userId)
}

/**
 * Basic, unscoped token so a Reception/admin user can log in and receive
 * call invitations before any specific call exists — mounted once at the
 * hotel portal layout level (voice-call-listener.tsx), refreshed by the
 * client well before this TTL via the SDK's onTokenWillExpire hook.
 */
export function getStaffVoiceCallToken(actor: HotelSessionUser) {
  requireReceptionOrAdmin(actor)
  const userId = staffZegoUserId(actor.id)
  return {
    appId: getZegoAppId(),
    token: generateZegoToken(userId, LISTENER_TOKEN_TTL_SECONDS),
    userId,
    userName: actor.roleName ?? 'Reception',
  }
}

/**
 * Keyed by `zegoRoomId`, not our own `call_log_id` — the answering staff
 * client only ever learns the Zego-side callID (from
 * onIncomingCallReceived), never our internal DB id. The guest sets
 * call_logs.zego_room_id and Zego's callID to the same value up front
 * (sendCallInvitation's explicit `roomID` param), which is what makes this
 * lookup work; `zego_room_id` is `@unique` in the schema for exactly this.
 *
 * First-to-answer wins: only succeeds from 'ringing'. A second staff
 * member's client attempting this after that gets an InvalidTransitionError,
 * so its UI can say "already answered by another staff member" instead of
 * silently overwriting who took the call.
 */
export async function answerVoiceCall(actor: HotelSessionUser, zegoRoomId: string) {
  requireReceptionOrAdmin(actor)

  const callLog = await prisma.call_logs.findFirstOrThrow({
    where: { zego_room_id: zegoRoomId, hotel_id: actor.hotelId },
  })
  if (callLog.status !== 'ringing') {
    throw new InvalidTransitionError('This call was already answered, or is no longer active.')
  }

  const updated = await prisma.call_logs.update({
    where: { call_log_id: callLog.call_log_id },
    data: { status: 'answered', answered_by: actor.id, answered_at: new Date() },
  })

  const userId = staffZegoUserId(actor.id)
  return {
    callLog: updated,
    appId: getZegoAppId(),
    token: generateZegoToken(userId, ANSWER_TOKEN_TTL_SECONDS, updated.zego_room_id),
    userId,
    userName: actor.roleName ?? 'Reception',
    roomId: updated.zego_room_id,
  }
}

/**
 * Reception-initiated hangup, or the server-side echo of the guest having
 * disconnected (voice-call-listener.tsx's onUserLeave/onLeaveRoom room
 * callbacks call this in both cases — see the comment there for why the
 * call-invitation layer alone can't be trusted to catch a callee hangup or a
 * dropped connection). Idempotent, mirroring apps/guest's endVoiceCall: only
 * an 'answered' call can be 'ended' here, so a late/duplicate call is a
 * silent no-op instead of clobbering a status another path already set.
 */
export async function endVoiceCall(actor: HotelSessionUser, zegoRoomId: string) {
  requireReceptionOrAdmin(actor)
  const callLog = await prisma.call_logs.findFirstOrThrow({
    where: { zego_room_id: zegoRoomId, hotel_id: actor.hotelId },
  })

  if (callLog.status !== 'answered') {
    return callLog
  }

  return prisma.call_logs.update({
    where: { call_log_id: callLog.call_log_id },
    data: { status: 'ended', ended_at: new Date() },
  })
}

/**
 * Best-effort signal only — deliberately does NOT change the shared
 * call_logs row. Every Reception/admin user at the hotel is rung
 * simultaneously (v1 has no "on duty" concept — see the voice calling
 * plan), so one person declining must never end the call for everyone else
 * still being rung. Only answerVoiceCall (first writer wins) and the
 * guest's own hangup (ringing -> missed, voice-call.service.ts in
 * apps/guest) are allowed to change status. This just confirms the call log
 * is real and hotel-scoped, and gives a home for a future decline audit.
 */
export async function declineVoiceCall(actor: HotelSessionUser, zegoRoomId: string) {
  requireReceptionOrAdmin(actor)
  return prisma.call_logs.findFirstOrThrow({
    where: { zego_room_id: zegoRoomId, hotel_id: actor.hotelId },
  })
}

/**
 * Most recent first. Used two ways: the Reception dashboard's "Recent
 * Calls" panel passes `limit: 5`; the full Call Logs page (Communication
 * section) omits it for the complete hotel-wide history.
 */
export async function listCallLogs(hotelId: string, actor: HotelSessionUser, limit?: number) {
  requireReceptionOrAdmin(actor)
  return prisma.call_logs.findMany({
    where: { hotel_id: hotelId },
    orderBy: { initiated_at: 'desc' },
    take: limit,
    include: {
      rooms: { select: { room_number: true } },
      users: { select: { full_name: true } },
    },
  })
}
