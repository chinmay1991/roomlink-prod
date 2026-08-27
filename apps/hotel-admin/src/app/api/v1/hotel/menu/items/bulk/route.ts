import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { bulkCreateMenuItemsSchema } from '@/server/validation/menu.schema'
import { bulkCreateMenuItems } from '@/server/services/menu.service'

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_menu', 'create')

    const body = bulkCreateMenuItemsSchema.parse(await req.json())
    const items = await bulkCreateMenuItems(user.hotelId, body, user)
    return NextResponse.json(items, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
