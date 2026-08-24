import { randomBytes } from 'crypto'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { generateZegoToken, getZegoAppId, shortZegoId } from '@/server/zego-token'
import { RateLimitedError } from '@/server/errors'
import type { GuestSessionContext } from '@/server/require-guest-session'

const MAX_CALLS_PER_HOUR = 5
const CALL_WINDOW_MS = 60 * 60 * 1000
const TOKEN_TTL_SECONDS = 600

/** Kept in sync with apps/hotel-admin's FRONT_OFFICE_ROLE_NAMES (src/lib/permissions.ts) — the two apps don't share a module, so this list is duplicated deliberately, same as the rest of this app's RBAC. */
const FRONT_OFFICE_ROLE_NAMES = ['Front Office Manager', 'Front Office Staff']

export function guestZegoUserId(sessionId: string): string {
  return shortZegoId('g', sessionId)
}

/** Must derive the same id apps/hotel-admin's staffZegoUserId does for the same user_id — that's what makes a call invitation actually reach that staff member's own login. */
export function staffZegoUserId(userId: string): string {
  return shortZegoId('s', userId)
}

/**
 * Starts a call attempt: rings every Front-Office-role staff user at this
 * hotel at once — deliberately Front Office only, not hotel_admin or any
 * other role, so a guest call rings the front desk and nowhere else (v1
 * has no "on duty" concept — see the voice calling plan), first to accept
 * in the client gets it. Rate-limited per guest session the same way
 * mobile verification is (session.service.ts) — persisted via `call_logs`
 * rows rather than an in-memory counter, since Vercel's serverless
 * instances don't share memory across requests.
 */
export async function startVoiceCall(ctx: GuestSessionContext) {
  const since = new Date(Date.now() - CALL_WINDOW_MS)
  const recentCalls = await prisma.call_logs.count({
    where: { guest_session_id: ctx.sessionId, initiated_at: { gte: since } },
  })
  if (recentCalls >= MAX_CALLS_PER_HOUR) {
    throw new RateLimitedError(Math.ceil(CALL_WINDOW_MS / 1000))
  }

  const [frontOfficeStaff, session] = await Promise.all([
    prisma.users.findMany({
      where: {
        hotel_id: ctx.hotelId,
        status: 'active',
        roles: { name: { in: FRONT_OFFICE_ROLE_NAMES } },
      },
      select: { user_id: true },
    }),
    prisma.guest_sessions.findUniqueOrThrow({
      where: { session_id: ctx.sessionId },
      select: {
        rooms: { select: { room_number: true } },
        guests: { select: { full_name: true } },
      },
    }),
  ])
  const roomNumber = session.rooms.room_number
  const guestName = session.guests?.full_name ?? null

  const zegoRoomId = `call_${ctx.hotelId}_${ctx.roomId}_${randomBytes(8).toString('hex')}`

  const callLog = await prisma.call_logs.create({
    data: {
      hotel_id: ctx.hotelId,
      room_id: ctx.roomId,
      guest_session_id: ctx.sessionId,
      zego_room_id: zegoRoomId,
      status: 'ringing',
    },
  })

  await recordAudit({
    actorId: ctx.guestId,
    actorType: 'guest',
    action: 'voice_call.started',
    entityType: 'call_log',
    entityId: callLog.call_log_id,
  })

  const userId = guestZegoUserId(ctx.sessionId)
  // Shown as the caller's display name by the Zego SDK itself if the
  // `data` payload (below) is ever unavailable/unparsed on the receiving
  // end — kept in sync with roomNumber/guestName as a fallback, not the
  // primary channel.
  const userName = guestName ? `Room ${roomNumber} (${guestName})` : `Room ${roomNumber}`

  return {
    callLogId: callLog.call_log_id,
    appId: getZegoAppId(),
    token: generateZegoToken(userId, TOKEN_TTL_SECONDS, zegoRoomId),
    userId,
    userName,
    roomId: zegoRoomId,
    roomNumber,
    guestName,
    calleeIds: frontOfficeStaff.map((u) => staffZegoUserId(u.user_id)),
  }
}

/**
 * Guest-initiated hangup. Resolves to 'missed' if no one had answered yet
 * (distinct from 'ended', which means a staff member was actually on the
 * call) — that distinction is the whole point of call_logs existing, so
 * Front Office's dashboard can show missed calls. Idempotent: calling this
 * again on an already-terminal call log is a silent no-op.
 */
export async function endVoiceCall(ctx: GuestSessionContext, callLogId: string) {
  const callLog = await prisma.call_logs.findFirstOrThrow({
    where: { call_log_id: callLogId, guest_session_id: ctx.sessionId },
  })

  if (callLog.status !== 'ringing' && callLog.status !== 'answered') {
    return callLog
  }

  return prisma.call_logs.update({
    where: { call_log_id: callLog.call_log_id },
    data: { status: callLog.status === 'answered' ? 'ended' : 'missed', ended_at: new Date() },
  })
}
