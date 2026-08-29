import type { request_status } from '@roomlink/db'

/**
 * PRD §17: NEW(pending) -> ASSIGNED -> IN_PROGRESS -> COMPLETED, plus optional CANCELLED/ESCALATED.
 *
 * `pending_acceptance` (reception assigned someone, awaiting their
 * accept/reject) deliberately has no outbound entries here — the only ways
 * out are the dedicated `acceptAssignment`/`rejectAssignment` actions, not
 * this generic status route, so a task can't be started/completed before
 * the assignee has confirmed it. `cancelled` is the one exception: reception
 * can still pull back a request that's stuck awaiting a response.
 */
export const REQUEST_TRANSITIONS: Record<request_status, request_status[]> = {
  pending: ['in_progress', 'cancelled', 'escalated'],
  pending_acceptance: ['cancelled'],
  assigned: ['in_progress', 'cancelled', 'escalated'],
  in_progress: ['completed', 'cancelled', 'escalated'],
  completed: [],
  cancelled: [],
  escalated: ['in_progress', 'cancelled'],
}

export function canTransition<T extends string>(map: Record<T, T[]>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false
}
