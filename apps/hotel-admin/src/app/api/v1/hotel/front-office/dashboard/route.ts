import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { toErrorResponse } from '@/server/api-error'
import { getFrontOfficeDashboard } from '@/server/services/front-office.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)

    const dashboard = await getFrontOfficeDashboard(user.hotelId, user)
    return NextResponse.json(dashboard)
  } catch (error) {
    return toErrorResponse(error)
  }
}
