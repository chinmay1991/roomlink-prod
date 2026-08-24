import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { toErrorResponse } from '@/server/api-error'
import { getDepartmentMonitoring, getStaffStatus } from '@/server/services/front-office.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    const [departments, staff] = await Promise.all([getDepartmentMonitoring(user.hotelId, user), getStaffStatus(user.hotelId, user)])
    return NextResponse.json({ departments, staff })
  } catch (error) {
    return toErrorResponse(error)
  }
}
