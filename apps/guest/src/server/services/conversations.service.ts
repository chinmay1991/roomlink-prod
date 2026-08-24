import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import type { SendMessageInput } from '@/server/validation/conversation.schema'
import type { GuestSessionContext } from '@/server/require-guest-session'

/**
 * Guest PRD §10 — one conversation thread per stay, reused across messages
 * (matches "Front Office is the primary operational contact" — a running
 * thread, not a new ticket per message). Reuses the existing `conversations`/
 * `messages` tables verbatim (`sender_type` already includes `guest`), per
 * both PRDs' explicit "do not create a separate chat database" instruction.
 * Scoped by `guest_session_id`, same isolation boundary as requests/orders.
 */
async function getOrCreateConversation(ctx: GuestSessionContext) {
  const existing = await prisma.conversations.findFirst({ where: { guest_session_id: ctx.sessionId } })
  if (existing) return existing

  const created = await prisma.conversations.create({
    data: {
      hotel_id: ctx.hotelId,
      room_id: ctx.roomId,
      guest_id: ctx.guestId,
      guest_session_id: ctx.sessionId,
      status: 'open',
    },
  })

  await recordAudit({
    actorId: ctx.guestId,
    actorType: 'guest',
    action: 'conversation.started',
    entityType: 'conversation',
    entityId: created.conversation_id,
  })

  return created
}

export async function sendGuestMessage(ctx: GuestSessionContext, input: SendMessageInput) {
  const conversation = await getOrCreateConversation(ctx)

  const message = await prisma.messages.create({
    data: {
      conversation_id: conversation.conversation_id,
      sender_type: 'guest',
      sender_id: ctx.guestId,
      content: input.content,
    },
  })

  if (conversation.status === 'closed') {
    await prisma.conversations.update({ where: { conversation_id: conversation.conversation_id }, data: { status: 'open', closed_at: null } })
  }

  return message
}

/** Returns null if the guest hasn't started a conversation yet this stay — a valid, expected empty state. */
export async function getGuestConversation(ctx: GuestSessionContext) {
  const conversation = await prisma.conversations.findFirst({ where: { guest_session_id: ctx.sessionId } })
  if (!conversation) return null

  const messages = await prisma.messages.findMany({
    where: { conversation_id: conversation.conversation_id },
    orderBy: { sent_at: 'asc' },
  })

  return { conversation, messages }
}
