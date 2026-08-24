import { z } from 'zod'
import { uuid } from './common'

export const createRequestSchema = z.object({
  roomId: uuid,
  departmentId: uuid,
  requestType: z.string().trim().min(2, 'What does the guest need?').max(150),
  priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})
export type CreateRequestInput = z.infer<typeof createRequestSchema>

export const assignRequestSchema = z.object({
  assigneeId: uuid,
})
export type AssignRequestInput = z.infer<typeof assignRequestSchema>

export const updateRequestStatusSchema = z
  .object({
    status: z.enum(['in_progress', 'completed', 'cancelled']),
    note: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  // PRD §11: cancellation is an "auditable exception" — a reason is mandatory, not just UI-nudged.
  .superRefine((input, ctx) => {
    if (input.status === 'cancelled' && !input.note) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'A reason is required to cancel a request' })
    }
  })
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>

export const escalateRequestSchema = z.object({
  urgency: z.enum(['normal', 'high', 'urgent']),
  recipient: z.enum(['front_office', 'gm']),
  reason: z.string().trim().min(3, 'A reason is required to escalate').max(800),
})
export type EscalateRequestInput = z.infer<typeof escalateRequestSchema>

export const addRequestNoteSchema = z.object({
  note: z.string().trim().min(2, 'Add a note').max(1000),
})
export type AddRequestNoteInput = z.infer<typeof addRequestNoteSchema>

export const requestFiltersSchema = z.object({
  departmentId: uuid.optional(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'escalated']).optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  roomId: uuid.optional(),
})
export type RequestFilters = z.infer<typeof requestFiltersSchema>
