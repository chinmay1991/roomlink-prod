import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { isNativeClient } from '@/server/is-native-client'
import { getStaffStatus } from '@/server/services/front-office.service'
import { Card, StatusBadge } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'
import { ClickableRow } from '@/components/layout/clickable-row'
import { StaffStatusCards } from './staff-status-cards'
import type { HotelSessionUser } from '@/server/require-hotel-session'

/** Front Office (formerly Reception PRD) §23 — limited operational staff view. No create/edit/delete capability here. */
export default async function StaffStatusPage() {
  const session = await requireHotelPageSession()
  const actor = session.user as HotelSessionUser
  const staff = await getStaffStatus(actor.hotelId, actor)

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={10} />
      <h1 className="text-xl font-semibold text-slate-900">Staff Status</h1>

      <Card className="overflow-hidden">
        {isNativeClient() ? (
          <StaffStatusCards staff={staff} />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Departments</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Active tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <ClickableRow key={s.user_id} href={`/hotel/requests?q=${encodeURIComponent(s.full_name)}`}>
                  <td className="px-5 py-2.5 font-medium text-slate-900">{s.full_name}</td>
                  <td className="px-5 py-2.5 text-slate-600">{s.departments.join(' + ') || '—'}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{s.activeWorkload}</td>
                </ClickableRow>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                    No staff yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  )
}
