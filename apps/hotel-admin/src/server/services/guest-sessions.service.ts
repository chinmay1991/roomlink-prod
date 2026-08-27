import { randomBytes } from 'crypto'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { normalizePhone } from '@/server/phone'
import { InvalidPhoneError, InvalidTransitionError } from '@/server/errors'
import type { IssueGuestSessionInput, UpdateGuestMobileInput } from '@/server/validation/guest-session.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

export async function listGuestSessions(hotelId: string) {
  return prisma.guest_sessions.findMany({
    where: { hotel_id: hotelId },
    orderBy: { issued_at: 'desc' },
    include: { rooms: { select: { room_number: true } }, guests: { select: { full_name: true } } },
  })
}

/**
 * Reception/GM "Activate Stay" action — a scanning guest verifies against
 * this stay's mobile number (never a PIN). A photographed old QR must not
 * grant access after checkout (PRD §12) — enforced here by only ever having
 * one active session per room at a time.
 */
export async function issueGuestSession(hotelId: string, input: IssueGuestSessionInput, actor: HotelSessionUser) {
  const room = await prisma.rooms.findFirstOrThrow({ where: { room_id: input.roomId, hotel_id: hotelId } })
  if (room.status !== 'active') {
    throw new InvalidTransitionError('Cannot activate a stay for a room that is not active.')
  }

  const normalizedMobile = normalizePhone(input.mobile)
  if (!normalizedMobile) throw new InvalidPhoneError()

  await prisma.guest_sessions.updateMany({
    where: { hotel_id: hotelId, room_id: input.roomId, status: 'active' },
    data: { status: 'terminated', terminated_by: actor.id, terminated_at: new Date() },
  })

  const sessionToken = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + input.hoursValid * 60 * 60 * 1000)

  let guestId: string | null = null
  if (input.guestName) {
    const guest = await prisma.guests.create({
      data: { hotel_id: hotelId, room_id: input.roomId, full_name: input.guestName, check_in_date: new Date() },
    })
    guestId = guest.guest_id
  }

  const session = await prisma.guest_sessions.create({
    data: {
      hotel_id: hotelId,
      room_id: input.roomId,
      guest_id: guestId,
      session_token: sessionToken,
      guest_mobile_e164: normalizedMobile,
      expires_at: expiresAt,
      status: 'active',
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'guest_session.issued',
    entityType: 'guest_session',
    entityId: session.session_id,
    afterState: { room_id: input.roomId },
  })

  return { session }
}

/**
 * Reception "Edit Mobile Number" action — rotates `session_token` so any
 * browser cookie already issued under the old number stops resolving via
 * `requireGuestSession` immediately, and clears any verification lockout so
 * the guest gets a clean slate against the new number.
 */
export async function updateGuestMobile(hotelId: string, sessionId: string, input: UpdateGuestMobileInput, actor: HotelSessionUser) {
  const before = await prisma.guest_sessions.findFirstOrThrow({ where: { session_id: sessionId, hotel_id: hotelId } })

  const normalizedMobile = normalizePhone(input.mobile)
  if (!normalizedMobile) throw new InvalidPhoneError()

  const after = await prisma.guest_sessions.update({
    where: { session_id: sessionId },
    data: {
      guest_mobile_e164: normalizedMobile,
      session_token: randomBytes(24).toString('hex'),
      failed_verification_attempts: 0,
      verification_locked_until: null,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'guest_session.mobile_updated',
    entityType: 'guest_session',
    entityId: sessionId,
    beforeState: { guest_mobile_e164: before.guest_mobile_e164 },
  })

  return after
}

export async function terminateGuestSession(hotelId: string, sessionId: string, actor: HotelSessionUser) {
  const before = await prisma.guest_sessions.findFirstOrThrow({ where: { session_id: sessionId, hotel_id: hotelId } })

  const after = await prisma.guest_sessions.update({
    where: { session_id: sessionId },
    data: { status: 'terminated', terminated_by: actor.id, terminated_at: new Date() },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'guest_session.terminated',
    entityType: 'guest_session',
    entityId: sessionId,
    beforeState: { status: before.status },
  })

  return after
}
