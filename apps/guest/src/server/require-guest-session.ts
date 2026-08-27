import { cookies } from 'next/headers'
import { prisma } from '@/server/db'
import { UnauthorizedError } from '@/server/errors'

export const GUEST_SESSION_COOKIE = 'rl_guest_session'

export type GuestSessionContext = {
  sessionId: string
  hotelId: string
  roomId: string
  guestId: string | null
}

/**
 * The guest module's `requireHotelSession` equivalent — every API route
 * calls this first. Identity is derived *only* from the httpOnly cookie
 * (`guest_sessions.session_token`, looked up fresh against the DB every
 * call) — never from a request body/query param. This is the load-bearing
 * security property the Guest PRD calls out repeatedly (§24/§25/§26): a
 * client can never assert its own `hotelId`/`roomId`/`sessionId`.
 *
 * Access has no time-based cutoff — a room's stay stays valid until
 * Reception explicitly ends it (`status` flips to `terminated`), not until
 * some clock reaches `expires_at`. `expires_at` is retained on the row for
 * display only; it is never compared against `now()` here.
 */
export async function requireGuestSession(): Promise<GuestSessionContext> {
  const token = cookies().get(GUEST_SESSION_COOKIE)?.value
  if (!token) throw new UnauthorizedError()

  const session = await prisma.guest_sessions.findUnique({ where: { session_token: token } })
  if (!session) throw new UnauthorizedError()
  if (session.status !== 'active') throw new UnauthorizedError()

  return {
    sessionId: session.session_id,
    hotelId: session.hotel_id,
    roomId: session.room_id,
    guestId: session.guest_id,
  }
}
