import { notFound } from 'next/navigation'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { getQrCodeForRoom } from '@/server/services/qr-codes.service'
import { getHotelProfile } from '@/server/services/hotel-profile.service'
import { RoomQrCard } from './room-qr-card'

export default async function QrCardPage({ params }: { params: { qrCodeId: string } }) {
  const session = await requireHotelPageSession()

  const qr = await getQrCodeForRoom(session.user.hotelId, params.qrCodeId).catch(() => null)
  if (!qr || !qr.is_active) notFound()

  const hotel = await getHotelProfile(session.user.hotelId)

  return (
    <RoomQrCard
      hotelName={hotel.name}
      roomNumber={qr.rooms.room_number}
      imageSrc={`/api/v1/hotel/qr-codes/code/${qr.qr_code_id}/card-image`}
    />
  )
}
