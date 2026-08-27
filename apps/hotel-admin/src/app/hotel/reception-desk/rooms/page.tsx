import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { isNativeClient } from '@/server/is-native-client'
import { getRoomOverview } from '@/server/services/reception.service'
import { Card } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'
import { ClickableRow } from '@/components/layout/clickable-row'
import { RoomOverviewCards } from './room-overview-cards'
import type { HotelSessionUser } from '@/server/require-hotel-session'

/** Reception PRD §21 — room-level operational overview. Not a PMS. */
export default async function RoomsOverviewPage() {
  const session = await requireHotelPageSession()
  const actor = session.user as HotelSessionUser
  const rooms = await getRoomOverview(actor.hotelId, actor)
  const hotelName = session.user.hotelName ?? 'this hotel'

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={10} />
      <h1 className="text-xl font-semibold text-slate-900">Rooms</h1>
      <Card className="overflow-hidden">
        {isNativeClient() ? (
          <RoomOverviewCards rooms={rooms} hotelName={hotelName} />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Building</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Occupancy</th>
                <th className="px-5 py-3 font-medium">Guest session</th>
                <th className="px-5 py-3 font-medium">Open requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <ClickableRow key={r.room_id} href={`/hotel/requests?q=${encodeURIComponent(r.room_number)}`}>
                  <td className="px-5 py-2.5 font-medium text-slate-900">{r.room_number}</td>
                  <td className="px-5 py-2.5 text-slate-600">{r.building ?? hotelName}</td>
                  <td className="px-5 py-2.5 text-slate-600">{r.roomType ?? '—'}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        r.occupied
                          ? 'inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20'
                          : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20'
                      }
                    >
                      {r.occupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">{r.activeGuestSessionId ? 'Active' : '—'}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{r.openRequests}</td>
                </ClickableRow>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    No rooms yet.
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
