import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { rejectAssignmentSchema } from '@/server/validation/request.schema'
import { rejectAssignment } from '@/server/services/requests.service'

export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_requests', 'edit')

    const body = rejectAssignmentSchema.parse(await req.json().catch(() => ({})))
    const request = await rejectAssignment(user.hotelId, params.requestId, body.reason || undefined, user)
    return NextResponse.json(request)
  } catch (error) {
    return toErrorResponse(error)
  }
}
