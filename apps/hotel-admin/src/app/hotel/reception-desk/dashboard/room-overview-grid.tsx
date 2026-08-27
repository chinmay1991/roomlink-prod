'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Search, User, Wrench } from 'lucide-react'
import { Input, cn } from '@roomlink/ui'
import { floorLabel, groupByBuilding, groupByFloor } from '@/lib/floor'
import { Pager } from '@/components/pager'

type Room = {
  room_id: string
  room_number: string
  floor: string | null
  building: string | null
  status: string
  roomType: string | null
  occupied: boolean
  guestName: string | null
  openRequests: number
}

type Bucket = 'all' | 'occupied' | 'vacant' | 'out_of_order'

/** Reception PRD §21's room overview, re-shaped into the mockup's filterable grid. All fields come from `getRoomOverview` — no bucket here is invented: "reserved" has no backing data anywhere in the schema, so it's intentionally not offered as a tab. */
function bucketOf(room: Room): Exclude<Bucket, 'all'> {
  if (room.occupied) return 'occupied'
  if (room.status === 'maintenance' || room.status === 'inactive') return 'out_of_order'
  return 'vacant'
}

const TABS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'All Rooms' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'vacant', label: 'Vacant' },
  { key: 'out_of_order', label: 'Out of Order' },
]

export function RoomOverviewGrid({ rooms, hotelName }: { rooms: Room[]; hotelName: string }) {
  const [tab, setTab] = useState<Bucket>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: rooms.length, occupied: 0, vacant: 0, out_of_order: 0 }
    for (const r of rooms) c[bucketOf(r)]++
    return c
  }, [rooms])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rooms.filter((r) => {
      if (tab !== 'all' && bucketOf(r) !== tab) return false
      if (!q) return true
      return r.room_number.toLowerCase().includes(q) || (r.guestName?.toLowerCase().includes(q) ?? false)
    })
  }, [rooms, tab, query])

  // Two-level grouping: a hotel with multiple buildings can have the same
  // floor number repeat per building (Building A Floor 1 vs Building B
  // Floor 1), so floor pagination alone would conflate them.
  const buildingGroups = useMemo(() => groupByBuilding(filtered, hotelName), [filtered, hotelName])
  const [buildingPage, setBuildingPage] = useState(0)
  const [floorPage, setFloorPage] = useState(0)

  useEffect(() => {
    setBuildingPage(0)
    setFloorPage(0)
  }, [tab, query])

  const currentBuildingPage = Math.min(buildingPage, Math.max(0, buildingGroups.length - 1))
  const currentBuilding = buildingGroups[currentBuildingPage]

  const floorGroups = useMemo(() => groupByFloor(currentBuilding?.items ?? []), [currentBuilding])
  const currentFloorPage = Math.min(floorPage, Math.max(0, floorGroups.length - 1))
  const currentFloor = floorGroups[currentFloorPage]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search room..."
              className="w-48 pl-8"
            />
          </div>
          <div className="flex rounded-md border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              className={cn('rounded p-1.5', view === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100')}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              className={cn('rounded p-1.5', view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100')}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {buildingGroups.length > 1 && (
        <Pager
          items={buildingGroups.map((g) => ({ key: g.building, label: g.building }))}
          currentIndex={currentBuildingPage}
          onSelect={(idx) => {
            setBuildingPage(idx)
            setFloorPage(0)
          }}
        />
      )}

      {filtered.length === 0 || !currentFloor ? (
        <p className="py-10 text-center text-sm text-slate-500">No rooms match.</p>
      ) : (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {currentBuilding && buildingGroups.length > 1 ? `${currentBuilding.building} · ` : ''}
            {currentFloor.floor === null ? 'Unassigned' : `Floor ${currentFloor.floor}`} ({currentFloor.items.length})
          </h3>
          {view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {currentFloor.items.map((r) => (
                <RoomCard key={r.room_id} room={r} />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {currentFloor.items.map((r) => {
                const bucket = bucketOf(r)
                return (
                  <li key={r.room_id}>
                    <Link href={`/hotel/requests?q=${encodeURIComponent(r.room_number)}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{r.room_number}</span>
                        <span className="text-slate-500">{r.roomType ?? 'No room type'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.guestName && <span className="text-slate-600">{r.guestName}</span>}
                        <BucketBadge bucket={bucket} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {floorGroups.length > 1 && (
            <div className="border-t border-slate-100 pt-4">
              <Pager
                items={floorGroups.map((g) => ({ key: g.floor === null ? 'unassigned' : String(g.floor), label: floorLabel(g.floor) }))}
                currentIndex={currentFloorPage}
                onSelect={setFloorPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BucketBadge({ bucket }: { bucket: Exclude<Bucket, 'all'> }) {
  const TONE = {
    occupied: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    vacant: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    out_of_order: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  } as const
  const LABEL = { occupied: 'Occupied', vacant: 'Vacant', out_of_order: 'Out of Order' } as const
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[bucket])}>
      {LABEL[bucket]}
    </span>
  )
}

function RoomCard({ room }: { room: Room }) {
  const bucket = bucketOf(room)
  const BORDER = {
    occupied: 'border-l-blue-500',
    vacant: 'border-l-emerald-500',
    out_of_order: 'border-l-amber-500',
  } as const

  return (
    <Link
      href={`/hotel/requests?q=${encodeURIComponent(room.room_number)}`}
      className={cn(
        'block rounded-lg border border-l-4 border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
        BORDER[bucket]
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-base font-semibold text-slate-900">{room.room_number}</p>
        {bucket === 'occupied' ? (
          <User className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
        ) : bucket === 'out_of_order' ? (
          <Wrench className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        ) : null}
      </div>
      <div className="mt-1">
        <BucketBadge bucket={bucket} />
      </div>
      <p className="mt-1.5 truncate text-xs text-slate-500">
        {bucket === 'occupied' ? room.guestName ?? 'Guest' : room.roomType ?? 'No room type'}
      </p>
      {room.openRequests > 0 && (
        <p className="mt-1 text-xs font-medium text-red-600">
          {room.openRequests} open request{room.openRequests === 1 ? '' : 's'}
        </p>
      )}
    </Link>
  )
}
