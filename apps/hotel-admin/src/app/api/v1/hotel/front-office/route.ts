import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { createFrontOfficeStaffSchema } from '@/server/validation/staff.schema'
import { listFrontOfficeStaff, createFrontOfficeStaff } from '@/server/services/staff.service'

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_staff', 'view')

    const frontOfficeStaff = await listFrontOfficeStaff(user.hotelId)
    return NextResponse.json(frontOfficeStaff)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_staff', 'create')

    const body = createFrontOfficeStaffSchema.parse(await req.json())
    const result = await createFrontOfficeStaff(user.hotelId, body, user)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
