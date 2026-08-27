import { prisma } from '@/server/db'
import { toGuestRequestStatus, GUEST_REQUEST_STATUS_LABEL, GUEST_ORDER_STATUS_LABEL } from '@/lib/guest-status'
import type { GuestSessionContext } from '@/server/require-guest-session'

export type GuestNotification = {
  id: string
  message: string
  createdAt: Date
}

/**
 * Guest PRD §19 — computed from existing timestamped data, no stored
 * `notifications` table or read-state, same precedent every other module in
 * this codebase already set (`alerts.service.ts`). Two sources:
 *
 * - `request_status_history` already has one row per transition with a
 *   real `changed_at` — request notifications come straight from it.
 * - `orders` has no per-transition history table at all (unlike requests),
 *   so an order can only ever surface as *one* notification reflecting its
 *   *current* status (not a full trail of every transition) — an honest
 *   limit of the existing schema, not something this module invents a new
 *   table to work around, matching PRD §34's "do not silently redesign the
 *   database" instruction for something this minor.
 */
export async function getGuestNotifications(ctx: GuestSessionContext): Promise<GuestNotification[]> {
  const [historyEntries, orders, conversation] = await Promise.all([
    prisma.request_status_history.findMany({
      where: { requests: { guest_session_id: ctx.sessionId }, from_status: { not: null } },
      include: { requests: { select: { request_type: true } } },
      orderBy: { changed_at: 'desc' },
    }),
    prisma.orders.findMany({ where: { guest_session_id: ctx.sessionId, status: { not: 'pending' } } }),
    prisma.conversations.findFirst({ where: { guest_session_id: ctx.sessionId } }),
  ])

  const notifications: GuestNotification[] = historyEntries.map((h) => ({
    id: `req-${h.history_id}`,
    message: `${h.requests.request_type}: ${GUEST_REQUEST_STATUS_LABEL[toGuestRequestStatus(h.to_status ?? '')]}`,
    createdAt: h.changed_at,
  }))

  for (const order of orders) {
    notifications.push({
      id: `order-${order.order_id}-${order.status}`,
      message: `Your restaurant order is ${GUEST_ORDER_STATUS_LABEL[order.status] ?? order.status}`,
      createdAt: order.delivered_at ?? order.created_at,
    })
  }

  if (conversation) {
    const staffMessages = await prisma.messages.findMany({
      where: { conversation_id: conversation.conversation_id, sender_type: 'staff' },
      orderBy: { sent_at: 'desc' },
      take: 10,
    })
    for (const m of staffMessages) {
      notifications.push({ id: `msg-${m.message_id}`, message: `Reception: ${m.content}`, createdAt: m.sent_at })
    }
  }

  return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
