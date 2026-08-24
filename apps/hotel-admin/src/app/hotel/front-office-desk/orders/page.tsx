import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listHotelOrders } from '@/server/services/orders.service'
import { Card, StatusBadge, timeAgo, formatCurrency } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'

/** Front Office (formerly Reception PRD) §24 — hotel-wide, read-only. No status-change actions (restaurant staff own execution). */
export default async function FrontOfficeOrdersPage() {
  const session = await requireHotelPageSession()
  const orders = await listHotelOrders(session.user.hotelId)

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={20} />
      <h1 className="text-xl font-semibold text-slate-900">Restaurant Orders</h1>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.order_id} className="align-top">
                  <td className="px-5 py-2.5 font-medium text-slate-900">{o.rooms?.room_number ?? '—'}</td>
                  <td className="px-5 py-2.5 text-slate-600">{o.guests?.full_name ?? '—'}</td>
                  <td className="px-5 py-2.5 text-slate-700">
                    {o.order_items.map((oi) => (
                      <p key={oi.order_item_id}>
                        {oi.quantity} × {oi.menu_items.name}
                      </p>
                    ))}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-700">{formatCurrency(o.total_amount.toString())}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{timeAgo(o.created_at)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    No orders yet.
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
