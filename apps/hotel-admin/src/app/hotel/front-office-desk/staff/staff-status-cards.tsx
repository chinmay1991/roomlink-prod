import Link from 'next/link'
import { StatusBadge } from '@roomlink/ui'

type StaffStatusRow = {
  user_id: string
  full_name: string
  departments: string[]
  status: string
  activeWorkload: number
}

/**
 * Native-only stacked-card alternative to the desktop staff-status table
 * (see page.tsx) — rendered exclusively when isNativeClient() is true, so
 * browsers never see this. Same data, same destination as the desktop
 * ClickableRow.
 */
export function StaffStatusCards({ staff }: { staff: StaffStatusRow[] }) {
  if (staff.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No staff yet.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {staff.map((s) => (
        <li key={s.user_id}>
          <Link
            href={`/hotel/requests?q=${encodeURIComponent(s.full_name)}`}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900">{s.full_name}</p>
              <p className="text-xs text-slate-500">{s.departments.join(' + ') || 'No departments'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={s.status} />
              <span className="text-xs tabular-nums text-slate-500">{s.activeWorkload} active</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
