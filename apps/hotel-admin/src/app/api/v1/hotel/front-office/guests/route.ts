import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { toErrorResponse } from '@/server/api-error'
import { searchGuests } from '@/server/services/front-office.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    const { searchParams } = new URL(req.url)
    const results = await searchGuests(user.hotelId, searchParams.get('q') || '', user)
    return NextResponse.json(results)
  } catch (error) {
    return toErrorResponse(error)
  }
}
