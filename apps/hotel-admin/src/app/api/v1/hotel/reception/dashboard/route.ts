import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { toErrorResponse } from '@/server/api-error'
import { getReceptionDashboard } from '@/server/services/reception.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)

    const dashboard = await getReceptionDashboard(user.hotelId, user)
    return NextResponse.json(dashboard)
  } catch (error) {
    return toErrorResponse(error)
  }
}
