import { prisma } from '@/server/db'

const ORDER_INCLUDE = {
  rooms: { select: { room_number: true } },
  guests: { select: { full_name: true } },
  order_items: { include: { menu_items: { select: { name: true, price: true } } } },
} as const

/**
 * Front Office (formerly Reception PRD) §24 — hotel-wide visibility only. No status-mutation
 * function exists here on purpose: Front Office monitors and communicates
 * status to the guest, but "restaurant staff/manager remain responsible for
 * order execution" (PRD's own words) — building that side is out of this
 * module's scope.
 */
export async function listHotelOrders(hotelId: string) {
  return prisma.orders.findMany({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'desc' },
    include: ORDER_INCLUDE,
  })
}

export async function getOrder(hotelId: string, orderId: string) {
  return prisma.orders.findFirstOrThrow({
    where: { order_id: orderId, hotel_id: hotelId },
    include: ORDER_INCLUDE,
  })
}
