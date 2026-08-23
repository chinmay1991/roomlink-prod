import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { getQrCodeForRoom, buildRoomQrUrl } from '@/server/services/qr-codes.service'
import { getHotelProfile } from '@/server/services/hotel-profile.service'
import { generateRoomQrCardImage } from '@/server/services/qr-card-image.service'

/**
 * Renders the printable room card as a PNG on demand, compositing the
 * hotel's real name and a room-specific QR code onto the designer template
 * (see qr-card-image.service.ts) — nothing is stored as an image blob.
 */
export async function GET(req: NextRequest, { params }: { params: { qrCodeId: string } }) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_qr_codes', 'view')

    const [qr, hotel] = await Promise.all([getQrCodeForRoom(user.hotelId, params.qrCodeId), getHotelProfile(user.hotelId)])
    const payload = buildRoomQrUrl(qr.code_value)

    const png = await generateRoomQrCardImage({
      hotelName: hotel.name,
      roomNumber: qr.rooms.room_number,
      qrPayload: payload,
    })

    const download = new URL(req.url).searchParams.get('download') === 'true'
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="room-${qr.rooms.room_number}-card.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
