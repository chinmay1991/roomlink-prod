import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { Prisma } from '@roomlink/db'
import { authOptions } from '@/server/auth'
import { HOTEL_PORTAL_USER_TYPES, HotelPortalUserType } from '@/lib/permissions'
import { canHotel } from '@/server/hotel-rbac'
import type { HotelSessionUser } from '@/server/require-hotel-session'
import { getQrCodeForRoom, buildRoomQrUrl } from '@/server/services/qr-codes.service'
import { getHotelProfile } from '@/server/services/hotel-profile.service'
import { generateRoomQrCardImage } from '@/server/services/qr-card-image.service'

/**
 * Pages Router (not App Router, unlike every other /api/v1/hotel/* route)
 * — deliberately, not for consistency. sharp resolves its platform binary
 * (@img/sharp-linux-x64) via a require() built from process.platform/
 * process.arch at runtime, which @vercel/nft's build-time file tracer can't
 * follow statically, so it never got bundled into the deployed function —
 * confirmed via a production 500: "Could not load the sharp module using
 * the linux-x64 runtime". next.config.js's outputFileTracingIncludes is the
 * documented fix for exactly this kind of tracing gap, but in this Next.js
 * version that option only walks the Pages Router page graph
 * (pageKeys.pages) — App Router route handlers are silently skipped
 * (verified by reading node_modules/next/dist/build/collect-build-traces.js).
 * Moving just this one route here was the only way found to actually get
 * the override applied. See qr-card-image.service.ts for the compositing
 * logic itself, which is unchanged.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await getServerSession(req, res, authOptions)
  const userType = session?.user?.userType
  const hotelId = session?.user?.hotelId
  if (!session?.user || !userType || !HOTEL_PORTAL_USER_TYPES.includes(userType as HotelPortalUserType) || !hotelId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user: HotelSessionUser = {
    id: session.user.id,
    userType: userType as HotelPortalUserType,
    roleId: session.user.roleId,
    roleName: session.user.roleName ?? null,
    hotelId,
  }

  if (!(await canHotel(user, 'hotel_qr_codes', 'view'))) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const { qrCodeId } = req.query
  if (typeof qrCodeId !== 'string') {
    res.status(400).json({ error: 'Invalid qrCodeId' })
    return
  }

  try {
    const [qr, hotel] = await Promise.all([getQrCodeForRoom(user.hotelId, qrCodeId), getHotelProfile(user.hotelId)])
    const payload = buildRoomQrUrl(qr.code_value)

    const png = await generateRoomQrCardImage({
      hotelName: hotel.name,
      roomNumber: qr.rooms.room_number,
      qrPayload: payload,
      receptionContact: hotel.reception_contact,
      roomServiceContact: hotel.room_service_contact,
    })

    const download = req.query.download === 'true'
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="room-${qr.rooms.room_number}-card.png"`)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(png)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: 'Not found' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Something went wrong' })
  }
}
