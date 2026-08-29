/**
 * Guest PRD §13's stepper only shows NEW/ASSIGNED/IN_PROGRESS/COMPLETED/
 * CANCELLED — `escalated` is an internal operational signal (Department
 * Manager routing to the GM) that shouldn't leak to the guest as a distinct
 * concept (privacy §37: "do not expose... internal administrative
 * information"). Every guest-facing display of a request status routes
 * through this first. `pending_acceptance` (reception assigned someone, not
 * yet confirmed) is the same kind of internal detail — a guest just sees
 * "Assigned" the moment reception routes their request, same as before this
 * status existed.
 */
export function toGuestRequestStatus(status: string): 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' {
  if (status === 'escalated') return 'in_progress'
  if (status === 'pending_acceptance') return 'assigned'
  return status as 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
}

export const GUEST_REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: 'Request Received',
  assigned: 'Assigned',
  in_progress: 'Being Prepared',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const GUEST_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Order Received',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
