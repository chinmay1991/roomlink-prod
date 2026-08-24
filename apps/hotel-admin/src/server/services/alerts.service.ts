import { prisma } from '@/server/db'

export type Alert = {
  id: string
  severity: 'critical' | 'warning'
  message: string
  href: string
}

const UNASSIGNED_THRESHOLD_MIN = 15

/**
 * Computed, not stored — PRD §20/§14 explicitly says not to overbuild
 * notification infra in V1 (in-app only, no push/email/SMS queue). Every
 * alert here is a live query against existing data, shared by both the
 * Notifications page and the Dashboard so the two never drift apart.
 */
export async function getHotelAlerts(hotelId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const staleCutoff = new Date(Date.now() - UNASSIGNED_THRESHOLD_MIN * 60 * 1000)

  const [unassigned, escalated, qrMissing, unavailableItems] = await Promise.all([
    prisma.requests.findMany({
      where: { hotel_id: hotelId, status: 'pending', created_at: { lt: staleCutoff } },
      include: { rooms: { select: { room_number: true } } },
      take: 20,
    }),
    prisma.requests.findMany({
      where: { hotel_id: hotelId, status: 'escalated' },
      include: { rooms: { select: { room_number: true } } },
      take: 20,
    }),
    prisma.rooms.findMany({
      where: { hotel_id: hotelId, status: 'active', qr_codes: { none: { is_active: true } } },
      take: 20,
    }),
    prisma.menu_items.findMany({
      where: { hotel_id: hotelId, status: 'active', is_available: false },
      take: 20,
    }),
  ])

  for (const r of unassigned) {
    alerts.push({
      id: `unassigned-${r.request_id}`,
      severity: 'warning',
      message: `Unassigned: ${r.request_type} — Room ${r.rooms?.room_number ?? '?'}`,
      href: '/hotel/requests',
    })
  }
  for (const r of escalated) {
    alerts.push({
      id: `escalated-${r.request_id}`,
      severity: 'critical',
      message: `Escalated: ${r.request_type} — Room ${r.rooms?.room_number ?? '?'}`,
      href: '/hotel/requests',
    })
  }
  for (const room of qrMissing) {
    alerts.push({
      id: `qr-${room.room_id}`,
      severity: 'warning',
      message: `QR not activated for Room ${room.room_number}`,
      href: '/hotel/qr-codes',
    })
  }
  for (const item of unavailableItems) {
    alerts.push({
      id: `menu-${item.item_id}`,
      severity: 'warning',
      message: `${item.name} marked unavailable`,
      href: '/hotel/menu',
    })
  }

  return alerts
}

/**
 * Same computed-alert pattern, scoped to a Department Manager's own
 * department(s) (PRD §9) — no QR/menu alerts, since those aren't within
 * this role's authority (PRD §2 boundaries).
 */
export async function getDepartmentAlerts(hotelId: string, departmentIds: string[]): Promise<Alert[]> {
  const alerts: Alert[] = []
  const staleCutoff = new Date(Date.now() - UNASSIGNED_THRESHOLD_MIN * 60 * 1000)

  const [unassigned, escalated] = await Promise.all([
    prisma.requests.findMany({
      where: { hotel_id: hotelId, department_id: { in: departmentIds }, status: 'pending', created_at: { lt: staleCutoff } },
      include: { rooms: { select: { room_number: true } } },
      take: 20,
    }),
    prisma.requests.findMany({
      where: { hotel_id: hotelId, department_id: { in: departmentIds }, status: 'escalated' },
      include: { rooms: { select: { room_number: true } } },
      take: 20,
    }),
  ])

  for (const r of unassigned) {
    alerts.push({
      id: `unassigned-${r.request_id}`,
      severity: 'warning',
      message: `Unassigned: ${r.request_type} — Room ${r.rooms?.room_number ?? '?'}`,
      href: '/hotel/manager/queue',
    })
  }
  for (const r of escalated) {
    alerts.push({
      id: `escalated-${r.request_id}`,
      severity: 'critical',
      message: `Escalated: ${r.request_type} — Room ${r.rooms?.room_number ?? '?'}`,
      href: '/hotel/manager/queue',
    })
  }

  return alerts
}

/**
 * Same computed-alert pattern again, for Department Staff (Staff PRD §17) —
 * scoped to the staff member's own department(s), same as
 * `getDepartmentAlerts`, but pointing at the Staff task list rather than the
 * Manager queue since this role can't reach `/hotel/manager/*`. No
 * escalation alert: escalation is a Manager/Front Office/Hotel Admin action
 * (Staff PRD §14 — staff don't reassign/escalate, only accept/work/note).
 */
export async function getStaffAlerts(hotelId: string, departmentIds: string[]): Promise<Alert[]> {
  const alerts: Alert[] = []
  const staleCutoff = new Date(Date.now() - UNASSIGNED_THRESHOLD_MIN * 60 * 1000)

  const unassigned = await prisma.requests.findMany({
    where: { hotel_id: hotelId, department_id: { in: departmentIds }, status: 'pending', created_at: { lt: staleCutoff } },
    include: { rooms: { select: { room_number: true } } },
    take: 20,
  })

  for (const r of unassigned) {
    alerts.push({
      id: `unassigned-${r.request_id}`,
      severity: r.priority === 'urgent' ? 'critical' : 'warning',
      message: `Unclaimed: ${r.request_type} — Room ${r.rooms?.room_number ?? '?'}`,
      href: '/hotel/staff/tasks',
    })
  }

  return alerts
}
