import { PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listCallLogs } from '@/server/services/voice-call.service'
import { Card, timeAgo, formatDateTime } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'
import type { HotelSessionUser } from '@/server/require-hotel-session'

/** Communication section — full hotel-wide voice-call history. The Front Office dashboard's "Recent Calls" panel is the same data, capped to the 5 most recent; this page is the uncapped view. */
export default async function CallLogsPage() {
  const session = await requireHotelPageSession()
  const actor = session.user as HotelSessionUser
  const callLogs = await listCallLogs(actor.hotelId, actor)

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={20} />
      <h1 className="text-xl font-semibold text-slate-900">Call Logs</h1>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Answered by</th>
                <th className="px-5 py-3 font-medium">Initiated</th>
                <th className="px-5 py-3 font-medium">Ended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {callLogs.map((c) => (
                <tr key={c.call_log_id} className="align-top hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-900">{c.rooms?.room_number ?? '—'}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {c.status === 'missed' ? (
                        <PhoneMissed className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      ) : c.status === 'declined' ? (
                        <PhoneOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      ) : (
                        <PhoneIncoming className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      )}
                      <span className="capitalize text-slate-700">{c.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">{c.users?.full_name ?? '—'}</td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {formatDateTime(c.initiated_at)}
                    <span className="block text-xs text-slate-400">{timeAgo(c.initiated_at)}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{c.ended_at ? formatDateTime(c.ended_at) : '—'}</td>
                </tr>
              ))}
              {callLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    No calls yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
