import { prisma } from '@/server/db'

type DashboardKpiRow = {
  todays_requests: number
  pending: number
  in_progress: number
  completed: number
  active_rooms: number
  active_staff: number
}

export async function getDashboardData(hotelId: string) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  // The 4 `requests` counts below differ only in WHERE clause — one round
  // trip with conditional subqueries replaces four separate ones. Every
  // round trip to this database costs roughly the same regardless of query
  // complexity (see the latency audit), so collapsing count is what actually
  // helps, not query simplicity. departmentCount is dropped entirely and
  // derived from `departments.length` below — same where clause, so the
  // findMany already answers it for free.
  const [kpiRows, departments] = await Promise.all([
    prisma.$queryRaw<DashboardKpiRow[]>`
      SELECT
        (SELECT COUNT(*) FROM requests WHERE hotel_id = ${hotelId}::uuid AND created_at >= ${startOfDay})::int AS todays_requests,
        (SELECT COUNT(*) FROM requests WHERE hotel_id = ${hotelId}::uuid AND status IN ('pending', 'pending_acceptance', 'assigned'))::int AS pending,
        (SELECT COUNT(*) FROM requests WHERE hotel_id = ${hotelId}::uuid AND status = 'in_progress')::int AS in_progress,
        (SELECT COUNT(*) FROM requests WHERE hotel_id = ${hotelId}::uuid AND status = 'completed' AND completed_at >= ${startOfDay})::int AS completed,
        (SELECT COUNT(*) FROM rooms WHERE hotel_id = ${hotelId}::uuid AND status = 'active')::int AS active_rooms,
        (SELECT COUNT(*) FROM users WHERE hotel_id = ${hotelId}::uuid AND user_type = 'hotel_staff' AND status = 'active')::int AS active_staff
    `,
    prisma.departments.findMany({
      where: { hotel_id: hotelId, is_enabled: true },
      select: {
        department_id: true,
        name: true,
        requests: { select: { status: true } },
      },
    }),
  ])
  const kpiRow = kpiRows[0]

  const departmentSummary = departments.map((d) => ({
    departmentId: d.department_id,
    name: d.name,
    pending: d.requests.filter((r) => r.status === 'pending' || r.status === 'pending_acceptance' || r.status === 'assigned').length,
    inProgress: d.requests.filter((r) => r.status === 'in_progress').length,
    completed: d.requests.filter((r) => r.status === 'completed').length,
  }))

  return {
    kpis: {
      todaysRequests: kpiRow.todays_requests,
      pending: kpiRow.pending,
      inProgress: kpiRow.in_progress,
      completed: kpiRow.completed,
      activeRooms: kpiRow.active_rooms,
      activeStaff: kpiRow.active_staff,
      departmentCount: departments.length,
    },
    departmentSummary,
  }
}
