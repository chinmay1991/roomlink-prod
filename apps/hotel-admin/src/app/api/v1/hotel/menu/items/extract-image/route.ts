import { NextRequest, NextResponse } from 'next/server'
import { requireHotelSession } from '@/server/require-hotel-session'
import { requireCanHotel } from '@/server/hotel-rbac'
import { toErrorResponse } from '@/server/api-error'
import { extractMenuImageSchema } from '@/server/validation/menu.schema'
import { extractMenuItemsFromImage } from '@/server/services/menu-image-extraction.service'

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireHotelSession(req)
    await requireCanHotel(user, 'hotel_menu', 'create')

    const body = extractMenuImageSchema.parse(await req.json())
    const items = await extractMenuItemsFromImage(body)
    return NextResponse.json({ items })
  } catch (error) {
    return toErrorResponse(error)
  }
}
