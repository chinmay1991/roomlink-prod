import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { getMyPendingAssignments } from '@/server/services/requests.service'

/** Backs the staff-side assignment popup's poll — every request handed to this person that they haven't accepted or rejected yet. */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_requests', 'view')

    const requests = await getMyPendingAssignments(user.hotelId, user)
    return NextResponse.json(
      requests.map((r) => ({
        request_id: r.request_id,
        request_type: r.request_type,
        priority: r.priority,
        notes: r.notes,
        created_at: r.created_at,
        rooms: r.rooms,
        departments: r.departments,
      }))
    )
  } catch (error) {
    return toErrorResponse(error)
  }
}
