import { cn } from './utils'

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
} as const

type Tone = keyof typeof TONE_CLASSES

/** Every status/priority enum across the schema, mapped to a consistent semantic color. */
const STATUS_TONE: Record<string, Tone> = {
  // hotel_status
  pending: 'slate',
  onboarding: 'blue',
  trial: 'amber',
  active: 'green',
  suspended: 'red',
  churned: 'slate',
  // subscription_status
  paused: 'amber',
  cancelled: 'slate',
  expired: 'slate',
  // onboarding_step_status / ticket / request / order status
  in_progress: 'blue',
  complete: 'green',
  completed: 'green',
  open: 'blue',
  pending_acceptance: 'amber',
  assigned: 'blue',
  escalated: 'red',
  waiting_for_hotel: 'amber',
  resolved: 'green',
  closed: 'slate',
  preparing: 'blue',
  out_for_delivery: 'blue',
  delivered: 'green',
  // invoice / payment status
  draft: 'slate',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  refunded: 'slate',
  success: 'green',
  failed: 'red',
  // room status
  inactive: 'slate',
  maintenance: 'amber',
  // guest_session_status
  terminated: 'red',
  // request_priority
  normal: 'slate',
  high: 'amber',
  urgent: 'red',
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'slate'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        TONE_CLASSES[tone]
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
