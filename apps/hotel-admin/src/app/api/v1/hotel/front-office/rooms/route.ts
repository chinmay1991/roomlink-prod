import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { toErrorResponse } from '@/server/api-error'
import { getRoomOverview } from '@/server/services/front-office.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    const rooms = await getRoomOverview(user.hotelId, user)
    return NextResponse.json(rooms)
  } catch (error) {
    return toErrorResponse(error)
  }
}
