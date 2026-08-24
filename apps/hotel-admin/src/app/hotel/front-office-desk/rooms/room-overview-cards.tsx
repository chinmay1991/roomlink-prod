import Link from 'next/link'

type RoomOverviewRow = {
  room_id: string
  room_number: string
  building: string | null
  roomType: string | null
  occupied: boolean
  activeGuestSessionId: string | null
  openRequests: number
}

/**
 * Native-only stacked-card alternative to the desktop room-overview table
 * (see page.tsx) — rendered exclusively when isNativeClient() is true, so
 * browsers never see this. Same data, same destination as the desktop
 * ClickableRow.
 */
export function RoomOverviewCards({ rooms, hotelName }: { rooms: RoomOverviewRow[]; hotelName: string }) {
  if (rooms.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No rooms yet.</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rooms.map((r) => (
        <li key={r.room_id}>
          <Link
            href={`/hotel/requests?q=${encodeURIComponent(r.room_number)}`}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900">Room {r.room_number}</p>
              <p className="text-xs text-slate-500">
                {r.roomType ?? 'No room type'} · {r.building ?? hotelName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={
                  r.occupied
                    ? 'inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20'
                    : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20'
                }
              >
                {r.occupied ? 'Occupied' : 'Vacant'}
              </span>
              <span className="text-xs tabular-nums text-slate-500">{r.openRequests} open request{r.openRequests === 1 ? '' : 's'}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
