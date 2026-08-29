import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { acceptAssignment } from '@/server/services/requests.service'

export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_requests', 'edit')

    const request = await acceptAssignment(user.hotelId, params.requestId, user)
    return NextResponse.json(request)
  } catch (error) {
    return toErrorResponse(error)
  }
}
