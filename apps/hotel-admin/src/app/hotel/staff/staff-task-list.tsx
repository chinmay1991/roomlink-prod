'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Modal, Textarea, StatusBadge, timeAgo, cn } from '@roomlink/ui'

export type StaffRequestRow = {
  request_id: string
  request_type: string
  status: string
  priority: string
  notes: string | null
  created_at: string
  rooms: { room_number: string } | null
  guests: { full_name: string | null } | null
  departments: { department_id: string; name: string } | null
  users: { user_id: string; full_name: string } | null
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'pending_acceptance', label: 'Awaiting your response' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {children}
    </button>
  )
}

/**
 * The Staff PRD's mobile-first task view (§7/§8) — cards, one-tap actions,
 * no table. Shared between `/hotel/staff/home` (a capped preview, filters
 * hidden) and `/hotel/staff/tasks` (the full, filterable board).
 */
export function StaffTaskList({
  requests,
  departments,
  currentUserId,
  showFilters = true,
  limit,
  emptyMessage = 'No tasks right now.',
  initialStatusFilter = '',
  initialDeptFilter = '',
}: {
  requests: StaffRequestRow[]
  departments: { department_id: string; name: string }[]
  currentUserId: string
  showFilters?: boolean
  limit?: number
  emptyMessage?: string
  initialStatusFilter?: string
  initialDeptFilter?: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [deptFilter, setDeptFilter] = useState(initialDeptFilter)
  const [completeFor, setCompleteFor] = useState<string | null>(null)
  const [completeNote, setCompleteNote] = useState('')
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function runAction(requestId: string, run: () => Promise<Response>) {
    setBusyId(requestId)
    setError(null)
    const res = await run()
    setBusyId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Something went wrong. Please try again.')
      return
    }
    router.refresh()
  }

  function accept(requestId: string) {
    return runAction(requestId, () => fetch(`/api/v1/hotel/requests/${requestId}/accept`, { method: 'POST' }))
  }

  function acceptAssignment(requestId: string) {
    return runAction(requestId, () => fetch(`/api/v1/hotel/requests/${requestId}/assignment/accept`, { method: 'POST' }))
  }

  async function submitRejectAssignment() {
    if (!rejectFor) return
    const requestId = rejectFor
    await runAction(requestId, () =>
      fetch(`/api/v1/hotel/requests/${requestId}/assignment/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      })
    )
    setRejectFor(null)
    setRejectReason('')
  }

  function start(requestId: string) {
    return runAction(requestId, () =>
      fetch(`/api/v1/hotel/requests/${requestId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })
    )
  }

  async function submitComplete() {
    if (!completeFor) return
    const requestId = completeFor
    await runAction(requestId, () =>
      fetch(`/api/v1/hotel/requests/${requestId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', note: completeNote.trim() || undefined }),
      })
    )
    setCompleteFor(null)
    setCompleteNote('')
  }

  let filtered = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (deptFilter && r.departments?.department_id !== deptFilter) return false
    return true
  })
  if (limit) filtered = filtered.slice(0, limit)

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
          {departments.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Chip active={deptFilter === ''} onClick={() => setDeptFilter('')}>
                All
              </Chip>
              {departments.map((d) => (
                <Chip key={d.department_id} active={deptFilter === d.department_id} onClick={() => setDeptFilter(d.department_id)}>
                  {d.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        {filtered.map((r) => {
          const isMine = r.users?.user_id === currentUserId
          const isUnclaimed = r.status === 'pending'
          const busy = busyId === r.request_id

          return (
            <Card key={r.request_id} className="p-4">
              <Link href={`/hotel/staff/tasks/${r.request_id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">Room {r.rooms?.room_number ?? '—'}</p>
                    <p className="text-sm text-slate-700">{r.request_type}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {r.departments && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
                      {r.departments.name}
                    </span>
                  )}
                  <StatusBadge status={r.priority} />
                  <span className="text-slate-400">Created {timeAgo(r.created_at)}</span>
                </div>
                {!isMine && r.users && <p className="mt-1.5 text-xs text-slate-500">Assigned to {r.users.full_name}</p>}
              </Link>

              {isUnclaimed && (
                <Button className="mt-3 w-full" disabled={busy} onClick={() => accept(r.request_id)}>
                  {busy ? 'Accepting…' : 'Accept Task'}
                </Button>
              )}
              {isMine && r.status === 'pending_acceptance' && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => {
                      setRejectFor(r.request_id)
                      setRejectReason('')
                    }}
                  >
                    Reject
                  </Button>
                  <Button className="flex-1" disabled={busy} onClick={() => acceptAssignment(r.request_id)}>
                    {busy ? 'Accepting…' : 'Accept'}
                  </Button>
                </div>
              )}
              {isMine && r.status === 'assigned' && (
                <Button className="mt-3 w-full" disabled={busy} onClick={() => start(r.request_id)}>
                  {busy ? 'Starting…' : 'Start Task'}
                </Button>
              )}
              {isMine && r.status === 'in_progress' && (
                <Button className="mt-3 w-full" disabled={busy} onClick={() => setCompleteFor(r.request_id)}>
                  Complete Task
                </Button>
              )}
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <Card>
            <p className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
          </Card>
        )}
      </div>

      {completeFor && (
        <Modal
          title="Complete task"
          onClose={() => {
            setCompleteFor(null)
            setCompleteNote('')
          }}
        >
          <div className="space-y-3">
            <Textarea
              rows={3}
              placeholder="What did you do? (optional)"
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCompleteFor(null)
                  setCompleteNote('')
                }}
              >
                Cancel
              </Button>
              <Button disabled={busyId === completeFor} onClick={submitComplete}>
                Mark Completed
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {rejectFor && (
        <Modal
          title="Reject assignment"
          onClose={() => {
            setRejectFor(null)
            setRejectReason('')
          }}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">This sends the request back to reception, unassigned, so it can be routed to someone else.</p>
            <Textarea
              rows={3}
              placeholder="Why can't you take this on? (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectFor(null)
                  setRejectReason('')
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" disabled={busyId === rejectFor} onClick={submitRejectAssignment}>
                Reject
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
