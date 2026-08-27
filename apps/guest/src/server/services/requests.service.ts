import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { ForbiddenError } from '@/server/errors'
import type { CreateRequestInput } from '@/server/validation/request.schema'
import type { GuestSessionContext } from '@/server/require-guest-session'

const REQUEST_INCLUDE = {
  rooms: { select: { room_number: true } },
  departments: { select: { name: true } },
} as const

/**
 * Guest PRD §12 — service id is client-supplied, so it's proven to belong
 * to this hotel (and be currently requestable) before use, same
 * "cross-tenant FK validation" discipline apps/hotel-admin already applies
 * everywhere a client sends an id. Quantity/note fold into `notes` — there's
 * no dedicated quantity column on `requests` (matches how Reception's own
 * request-creation form already works, PRD §12's own worked example is a
 * request title + a free-text note).
 */
export async function createGuestRequest(ctx: GuestSessionContext, input: CreateRequestInput) {
  const service = await prisma.services.findFirstOrThrow({
    where: { service_id: input.serviceId, hotel_id: ctx.hotelId, status: 'active' },
    include: { departments: true },
  })
  if (service.department_id && service.departments && !service.departments.is_enabled) {
    throw new ForbiddenError('This service is currently unavailable')
  }

  const noteParts = [input.quantity > 1 ? `Qty: ${input.quantity}` : null, input.note || null].filter(Boolean)

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.requests.create({
      data: {
        hotel_id: ctx.hotelId,
        room_id: ctx.roomId,
        guest_id: ctx.guestId,
        guest_session_id: ctx.sessionId,
        department_id: service.department_id,
        request_type: service.name,
        priority: 'normal',
        notes: noteParts.length ? noteParts.join(' — ') : null,
        status: 'pending',
      },
    })

    await tx.request_status_history.create({
      data: { request_id: created.request_id, from_status: null, to_status: 'pending', changed_by: null },
    })

    await recordAudit(
      {
        actorId: ctx.guestId,
        actorType: 'guest',
        action: 'request.created',
        entityType: 'request',
        entityId: created.request_id,
        afterState: { request_type: created.request_type, room_id: created.room_id },
      },
      tx
    )

    return created
  })

  return prisma.requests.findUniqueOrThrow({ where: { request_id: request.request_id }, include: REQUEST_INCLUDE })
}

/** Guest PRD §14/§26 — this stay's requests only, scoped by `guest_session_id`, never by room or guest alone. */
export async function listGuestRequests(ctx: GuestSessionContext) {
  return prisma.requests.findMany({
    where: { guest_session_id: ctx.sessionId },
    orderBy: { created_at: 'desc' },
    include: REQUEST_INCLUDE,
  })
}

export async function getGuestRequestById(ctx: GuestSessionContext, requestId: string) {
  return prisma.requests.findFirstOrThrow({
    where: { request_id: requestId, guest_session_id: ctx.sessionId },
    include: REQUEST_INCLUDE,
  })
}
