import { waitUntil } from '@vercel/functions'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { normalizePhone } from '@/server/phone'
import { SessionNotActiveError, MobileMismatchError, RateLimitedError } from '@/server/errors'
import type { VerifySessionInput } from '@/server/validation/session.schema'
import type { GuestSessionContext } from '@/server/require-guest-session'

const MAX_VERIFICATION_ATTEMPTS = 5
const VERIFICATION_LOCKOUT_MS = 15 * 60 * 1000

/**
 * Guest PRD §2/§4 — the QR only ever identifies hotel + room, never
 * authenticates. `code_value` is opaque (already built for this by the
 * Hotel Admin module's qr_codes table) — this is the only thing the client
 * ever supplies to identify itself before verification.
 */
export async function resolveQrCode(codeValue: string) {
  const qr = await prisma.qr_codes.findUnique({
    where: { code_value: codeValue },
    include: { rooms: { include: { hotels: true } } },
  })

  if (!qr || !qr.is_active) {
    throw new SessionNotActiveError('invalid_qr', 'This RoomLink QR is not valid.')
  }
  if (qr.rooms.status !== 'active') {
    throw new SessionNotActiveError('room_inactive', 'RoomLink is currently unavailable for this room.')
  }

  const activeSession = await prisma.guest_sessions.findFirst({
    where: { hotel_id: qr.rooms.hotel_id, room_id: qr.rooms.room_id, status: 'active' },
  })
  if (!activeSession) {
    throw new SessionNotActiveError('no_active_stay', 'This RoomLink session is not currently active. Please contact Front Office.')
  }

  return {
    hotelId: qr.rooms.hotel_id,
    hotelName: qr.rooms.hotels.name,
    roomId: qr.rooms.room_id,
    roomNumber: qr.rooms.room_number,
  }
}

/**
 * Guest mobile-number verification — hotel + room + active stay, all
 * derived server-side from `codeValue`, never from a client-asserted
 * hotel/room id. The submitted number is normalized the same way Front Office's
 * input was at activation time before comparison — never compare a raw,
 * unnormalized value. Returns the session_token to be set as the guest's
 * cookie by the calling route handler (cookie mutation isn't available from
 * a plain service function in the App Router).
 */
export async function verifyGuestMobile(input: VerifySessionInput) {
  const { hotelId, roomId } = await resolveQrCode(input.codeValue)

  const session = await prisma.guest_sessions.findFirst({
    where: { hotel_id: hotelId, room_id: roomId, status: 'active' },
  })
  // resolveQrCode already proved an active session exists for this room —
  // re-check here defensively in case of a race between the two calls,
  // rather than assume it's still true a moment later.
  if (!session) {
    throw new SessionNotActiveError('no_active_stay', 'This RoomLink session is not currently active. Please contact Front Office.')
  }

  // Lockout is persisted on the guest_sessions row itself (not an in-memory
  // counter) so it holds up across Vercel's multiple, short-lived
  // serverless instances — an in-memory Map only works for a single
  // long-running process.
  if (session.verification_locked_until && session.verification_locked_until.getTime() > Date.now()) {
    throw new RateLimitedError(Math.ceil((session.verification_locked_until.getTime() - Date.now()) / 1000))
  }

  const normalized = normalizePhone(input.mobile)
  // An unparseable input is treated identically to a genuine mismatch — it
  // must never behave as a distinct error, or it becomes an oracle a guest
  // could use to probe which numbers are validly formatted vs. registered.
  const matches = normalized !== null && normalized === session.guest_mobile_e164
  if (!matches) {
    const attempts = session.failed_verification_attempts + 1
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + VERIFICATION_LOCKOUT_MS)
      await prisma.guest_sessions.update({
        where: { session_id: session.session_id },
        data: { failed_verification_attempts: attempts, verification_locked_until: lockedUntil },
      })
      throw new RateLimitedError(Math.ceil(VERIFICATION_LOCKOUT_MS / 1000))
    }
    await prisma.guest_sessions.update({
      where: { session_id: session.session_id },
      data: { failed_verification_attempts: attempts },
    })
    throw new MobileMismatchError()
  }

  // Success-path bookkeeping only — don't hold up the response for it.
  // (Failure-path writes above stay awaited: they're the lockout's actual
  // enforcement, not bookkeeping, so the next attempt must see them land.)
  if (session.failed_verification_attempts > 0 || session.verification_locked_until) {
    waitUntil(
      prisma.guest_sessions
        .update({
          where: { session_id: session.session_id },
          data: { failed_verification_attempts: 0, verification_locked_until: null },
        })
        .catch((err) => console.error('Failed to reset verification attempts', err))
    )
  }

  waitUntil(
    recordAudit({
      actorId: session.guest_id,
      actorType: 'guest',
      action: 'guest_session.verified',
      entityType: 'guest_session',
      entityId: session.session_id,
    }).catch((err) => console.error('Failed to record guest verification audit', err))
  )

  return session
}

/** Guest PRD §8/§22 — Home + Profile's "who am I, where am I" read. */
export async function getMe(ctx: GuestSessionContext) {
  const session = await prisma.guest_sessions.findUniqueOrThrow({
    where: { session_id: ctx.sessionId },
    include: {
      hotels: { select: { name: true } },
      rooms: { select: { room_number: true } },
      guests: { select: { full_name: true, check_in_date: true, check_out_date: true } },
    },
  })

  return {
    hotelName: session.hotels.name,
    roomNumber: session.rooms.room_number,
    guestName: session.guests?.full_name ?? null,
    checkInDate: session.guests?.check_in_date ?? session.issued_at,
    checkOutDate: session.guests?.check_out_date ?? session.expires_at,
    status: session.status,
    expiresAt: session.expires_at,
  }
}
