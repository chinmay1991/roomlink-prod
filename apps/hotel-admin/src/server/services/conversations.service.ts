import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import type { ReplyToConversationInput } from '@/server/validation/conversation.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

const CONVERSATION_INCLUDE = {
  rooms: { select: { room_number: true } },
  guests: { select: { full_name: true } },
  users: { select: { user_id: true, full_name: true } },
} as const

/**
 * Reception PRD §17 — hotel-wide, no department split (any Reception user
 * may open/reply to any conversation in their hotel). "Unread" isn't a
 * stored field (no read-state anywhere in this schema, matching the
 * project's computed-alert convention) — approximated as "the most recent
 * message was from the guest and nobody has replied since."
 */
export async function listConversations(hotelId: string) {
  const conversations = await prisma.conversations.findMany({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'desc' },
    include: {
      ...CONVERSATION_INCLUDE,
      messages: { orderBy: { sent_at: 'desc' }, take: 1 },
    },
  })

  return conversations.map((c) => ({
    ...c,
    lastMessage: c.messages[0] ?? null,
    hasUnreadGuestMessage: c.messages[0]?.sender_type === 'guest',
  }))
}

export async function getConversation(hotelId: string, conversationId: string) {
  const conversation = await prisma.conversations.findFirstOrThrow({
    where: { conversation_id: conversationId, hotel_id: hotelId },
    include: CONVERSATION_INCLUDE,
  })

  const messages = await prisma.messages.findMany({
    where: { conversation_id: conversationId },
    orderBy: { sent_at: 'asc' },
  })

  // Reception PRD §18 — "where possible, connect guest conversations to
  // requests": a read-only cross-reference, not an auto-link. Shows recent
  // open work for the same room so Reception can decide whether to raise a
  // new request from this conversation, without inventing a join table.
  const relatedRequests = conversation.room_id
    ? await prisma.requests.findMany({
        where: { hotel_id: hotelId, room_id: conversation.room_id, status: { in: ['pending', 'assigned', 'in_progress', 'escalated'] } },
        include: { departments: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
        take: 5,
      })
    : []

  return { conversation, messages, relatedRequests }
}

export async function replyToConversation(hotelId: string, conversationId: string, input: ReplyToConversationInput, actor: HotelSessionUser) {
  const conversation = await prisma.conversations.findFirstOrThrow({ where: { conversation_id: conversationId, hotel_id: hotelId } })

  const message = await prisma.messages.create({
    data: {
      conversation_id: conversation.conversation_id,
      sender_type: 'staff',
      sender_id: actor.id,
      content: input.content,
    },
  })

  // Reopens a conversation the guest had (or Reception had) marked closed —
  // a reply always means the thread is active again.
  if (conversation.status === 'closed') {
    await prisma.conversations.update({ where: { conversation_id: conversation.conversation_id }, data: { status: 'open', closed_at: null } })
  }

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'conversation.replied',
    entityType: 'conversation',
    entityId: conversation.conversation_id,
  })

  return message
}
