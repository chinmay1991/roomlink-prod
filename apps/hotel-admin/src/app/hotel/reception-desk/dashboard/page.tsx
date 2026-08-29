import Link from 'next/link'
import {
  Users,
  ClipboardList,
  Loader,
  Clock,
  OctagonAlert,
  AlertTriangle,
  MessageSquareText,
  Search,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
} from 'lucide-react'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { getReceptionDashboard, getDepartmentMonitoring, getRoomOverview } from '@/server/services/reception.service'
import { listRequests } from '@/server/services/requests.service'
import { getHotelAlerts } from '@/server/services/alerts.service'
import { listConversations } from '@/server/services/conversations.service'
import { listCallLogs } from '@/server/services/voice-call.service'
import { Card, CardHeader, Input, StatusBadge, timeAgo } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'
import { ClickableRow } from '@/components/layout/clickable-row'
import { StatTile } from './stat-tile'
import { RoomOverviewGrid } from './room-overview-grid'
import type { HotelSessionUser } from '@/server/require-hotel-session'

const OPEN_STATUSES = ['pending', 'pending_acceptance', 'assigned', 'in_progress', 'escalated'] as const

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-slate-300',
}

/** Reception PRD §5/§21/§22 — hotel-wide operational dashboard, restyled to the requested mockup. Every panel reads real hotel data (requests, guest_sessions, conversations, alerts) already served by this app's Reception module; nothing here is fabricated. "Reserved" rooms and pre-arrival/departure forecasts are intentionally omitted — there is no reservation/booking table anywhere in the schema to back them. */
export default async function ReceptionDashboardPage() {
  const session = await requireHotelPageSession()
  const actor = session.user as HotelSessionUser

  const [kpis, departments, rooms, openRequests, alerts, conversations, recentCalls] = await Promise.all([
    getReceptionDashboard(actor.hotelId, actor),
    getDepartmentMonitoring(actor.hotelId, actor),
    getRoomOverview(actor.hotelId, actor),
    listRequests(actor.hotelId, {}, actor),
    getHotelAlerts(actor.hotelId),
    listConversations(actor.hotelId),
    listCallLogs(actor.hotelId, actor, 5),
  ])

  const newRequests = openRequests.filter((r) => r.status === 'pending').slice(0, 4)
  const monitorRequests = openRequests.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)).slice(0, 6)
  const needsReply = conversations.filter((c) => c.hasUnreadGuestMessage).slice(0, 4)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <PollingRefresh intervalSeconds={20} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{greeting}, Reception 👋</h1>
          <p className="text-sm text-slate-500">
            {session.user.hotelName} • Front Office
          </p>
        </div>
        <form action="/hotel/requests" method="GET" className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input name="q" placeholder="Search guest, room or request..." className="pl-9" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Guests In House" value={kpis.guestsInHouse} sublabel="Live count" icon={Users} color="blue" href="/hotel/reception-desk/rooms" />
        <StatTile
          label="New Requests"
          value={kpis.unassigned}
          sublabel="Need Attention"
          icon={ClipboardList}
          color="green"
          href="/hotel/requests?status=pending"
        />
        <StatTile label="Active Tasks" value={kpis.inProgress} sublabel="In Progress" icon={Loader} color="amber" href="/hotel/requests?status=in_progress" />
        <StatTile label="Delayed Requests" value={kpis.slaAtRisk} sublabel="Need Follow-up" icon={Clock} color="purple" href="/hotel/requests" />
        <StatTile
          label="Escalated"
          value={kpis.escalated}
          sublabel="High Priority"
          icon={OctagonAlert}
          color="red"
          href="/hotel/requests?status=escalated"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">New Requests</h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                {kpis.unassigned}
              </span>
            </div>
            <Link href="/hotel/requests?status=pending" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {newRequests.map((r) => (
              <li key={r.request_id}>
                <Link
                  href={`/hotel/requests?q=${encodeURIComponent(r.rooms?.room_number ?? '')}`}
                  className={`flex items-start justify-between gap-2 border-l-4 px-5 py-3 hover:bg-slate-50 ${PRIORITY_BORDER[r.priority] ?? 'border-l-slate-300'}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">Room {r.rooms?.room_number ?? '—'}</p>
                    <p className="truncate text-sm text-slate-600">{r.request_type}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={r.departments?.name ?? 'Unassigned'} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={r.priority} />
                    <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {newRequests.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No new requests.</li>}
          </ul>
        </Card>

        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Request Monitor</h2>
            <Link href="/hotel/requests" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Room</th>
                  <th className="px-5 py-2.5 font-medium">Request</th>
                  <th className="px-5 py-2.5 font-medium">Staff</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monitorRequests.map((r) => (
                  <ClickableRow key={r.request_id} href={`/hotel/requests?q=${encodeURIComponent(r.rooms?.room_number ?? '')}`}>
                    <td className="px-5 py-2.5 font-medium text-slate-900">{r.rooms?.room_number ?? '—'}</td>
                    <td className="px-5 py-2.5 text-slate-600">{r.request_type}</td>
                    <td className="px-5 py-2.5 text-slate-600">{r.users?.full_name ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{timeAgo(r.created_at)}</td>
                  </ClickableRow>
                ))}
                {monitorRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      No open requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Alerts</h2>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                  {alerts.length}
                </span>
              </div>
              <Link href="/hotel/notifications" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            </CardHeader>
            <ul className="divide-y divide-slate-100">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-start gap-2 px-5 py-3 text-sm hover:bg-slate-50">
                    {a.severity === 'critical' ? (
                      <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    )}
                    <span className="text-slate-700">{a.message}</span>
                  </Link>
                </li>
              ))}
              {alerts.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No alerts.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-slate-500" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900">Needs Reply</h2>
              </div>
              <Link href="/hotel/reception-desk/conversations" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            </CardHeader>
            <ul className="divide-y divide-slate-100">
              {needsReply.map((c) => (
                <li key={c.conversation_id}>
                  <Link href={`/hotel/reception-desk/conversations/${c.conversation_id}`} className="block px-5 py-3 text-sm hover:bg-slate-50">
                    <p className="font-medium text-slate-900">
                      Room {c.rooms?.room_number ?? '—'} {c.guests?.full_name ? `• ${c.guests.full_name}` : ''}
                    </p>
                    <p className="mt-0.5 truncate text-slate-500">{c.lastMessage?.content}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{timeAgo(c.lastMessage?.sent_at)}</p>
                  </Link>
                </li>
              ))}
              {needsReply.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">All caught up.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneIncoming className="h-4 w-4 text-slate-500" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900">Recent Calls</h2>
              </div>
              <Link href="/hotel/reception-desk/call-logs" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            </CardHeader>
            <ul className="divide-y divide-slate-100">
              {recentCalls.map((c) => (
                <li key={c.call_log_id} className="flex items-start gap-2 px-5 py-3 text-sm">
                  {c.status === 'missed' ? (
                    <PhoneMissed className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  ) : c.status === 'declined' ? (
                    <PhoneOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  ) : (
                    <PhoneIncoming className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">Room {c.rooms?.room_number ?? '—'}</p>
                    <p className="truncate text-slate-500">
                      {c.status === 'ringing' && 'Ringing…'}
                      {c.status === 'missed' && 'Missed call'}
                      {c.status === 'declined' && 'Declined'}
                      {(c.status === 'answered' || c.status === 'ended') && `Answered by ${c.users?.full_name ?? '—'}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.initiated_at)}</span>
                </li>
              ))}
              {recentCalls.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No calls yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Room Overview</h2>
          <Link href="/hotel/reception-desk/rooms" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            View all rooms
          </Link>
        </div>
        <RoomOverviewGrid rooms={rooms} hotelName={session.user.hotelName ?? 'this hotel'} />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">By department</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">Department</th>
                <th className="px-5 py-2.5 font-medium">New</th>
                <th className="px-5 py-2.5 font-medium">In progress</th>
                <th className="px-5 py-2.5 font-medium">Completed today</th>
                <th className="px-5 py-2.5 font-medium">Delayed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <ClickableRow key={d.department_id} href={`/hotel/requests?department=${d.department_id}`}>
                  <td className="px-5 py-2.5 font-medium text-slate-900">{d.name}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{d.newCount}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{d.inProgress}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{d.completedToday}</td>
                  <td className="px-5 py-2.5">
                    {d.delayed > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        {d.delayed} delayed
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </ClickableRow>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                    No enabled departments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-400">Updates automatically every 20 seconds.</p>
    </div>
  )
}
