'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, StatusBadge, Pagination } from '@roomlink/ui'

type Department = { department_id: string; name: string }
type StaffRow = {
  user_id: string
  full_name: string
  email: string
  employee_id: string | null
  status: string
  roles: { name: string }
  user_departments: { departments: Department }[]
  departments_managed: Department[]
}
type PaginationInfo = { page: number; totalPages: number; status: 'active' | 'disabled' }

export function StaffList({
  staff,
  departments,
  isNative = false,
  pagination,
}: {
  staff: StaffRow[]
  departments: Department[]
  isNative?: boolean
  pagination?: PaginationInfo
}) {
  const router = useRouter()
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams()
    if (pagination && pagination.status !== 'active') params.set('status', pagination.status)
    if (targetPage > 1) params.set('page', String(targetPage))
    const qs = params.toString()
    return qs ? `/hotel/staff?${qs}` : '/hotel/staff'
  }
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingDeptsFor, setEditingDeptsFor] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastTempPassword, setLastTempPassword] = useState<{ name: string; password: string } | null>(null)

  async function toggleStatus(userId: string) {
    setBusyId(userId)
    await fetch(`/api/v1/hotel/staff/${userId}/toggle-status`, { method: 'POST' })
    setBusyId(null)
    router.refresh()
  }

  async function resetAccess(userId: string, name: string) {
    setBusyId(userId)
    const res = await fetch(`/api/v1/hotel/staff/${userId}/reset-access`, { method: 'POST' })
    const data = await res.json()
    setBusyId(null)
    if (res.ok) setLastTempPassword({ name, password: data.tempPassword })
  }

  function openDeptEditor(row: StaffRow) {
    setEditingDeptsFor(row.user_id)
    setSelected(new Set(row.user_departments.map((ud) => ud.departments.department_id)))
  }

  async function saveDepartments(userId: string) {
    setBusyId(userId)
    await fetch(`/api/v1/hotel/staff/${userId}/departments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentIds: Array.from(selected) }),
    })
    setBusyId(null)
    setEditingDeptsFor(null)
    router.refresh()
  }

  const departmentEditor = (row: StaffRow) => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {departments.map((d) => (
          <label key={d.department_id} className="flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={selected.has(d.department_id)}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) next.add(d.department_id)
                else next.delete(d.department_id)
                setSelected(next)
              }}
            />
            {d.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button className="h-7 px-2 text-xs" disabled={busyId === row.user_id} onClick={() => saveDepartments(row.user_id)}>
          Save
        </Button>
        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingDeptsFor(null)}>
          Cancel
        </Button>
      </div>
    </div>
  )

  // Native-only stacked-card layout — see the mobile-app plan's isolation
  // mechanism. Reuses every handler/state above (toggleStatus, resetAccess,
  // department editing) so business logic never forks between browser and
  // native; only the layout does. Browsers always take the unchanged table
  // path below.
  if (isNative) {
    return (
      <div className="space-y-3">
        {lastTempPassword && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            New temporary password for {lastTempPassword.name}: <code className="font-mono">{lastTempPassword.password}</code>
          </div>
        )}
        <Card className="overflow-hidden">
          {staff.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No staff yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((row) => (
                <li key={row.user_id} className="space-y-2.5 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{row.full_name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                      {row.employee_id && <p className="text-xs text-slate-400">ID: {row.employee_id}</p>}
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-slate-600">
                    {row.roles.name}
                    {row.departments_managed.length > 0 && (
                      <span className="text-slate-400"> · Manages {row.departments_managed.map((d) => d.name).join(', ')}</span>
                    )}
                  </p>
                  {editingDeptsFor === row.user_id ? (
                    departmentEditor(row)
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.user_departments.length === 0 && <span className="text-xs text-slate-400">No departments</span>}
                      {row.user_departments.map((ud) => (
                        <span key={ud.departments.department_id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {ud.departments.name}
                        </span>
                      ))}
                      <button onClick={() => openDeptEditor(row)} className="text-xs text-brand-600 hover:text-brand-700">
                        Edit
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 flex-1 px-3 text-xs"
                      disabled={busyId === row.user_id}
                      onClick={() => resetAccess(row.user_id, row.full_name)}
                    >
                      Reset access
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 flex-1 px-3 text-xs"
                      disabled={busyId === row.user_id}
                      onClick={() => toggleStatus(row.user_id)}
                    >
                      {row.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} buildHref={buildHref} />}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {lastTempPassword && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          New temporary password for {lastTempPassword.name}: <code className="font-mono">{lastTempPassword.password}</code>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Employee ID</th>
                <th className="px-5 py-3 font-medium">Departments</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((row) => (
                <tr key={row.user_id} className="hover:bg-slate-50 align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{row.full_name}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{row.employee_id ?? '—'}</td>
                  <td className="px-5 py-3">
                    {editingDeptsFor === row.user_id ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {departments.map((d) => (
                            <label key={d.department_id} className="flex items-center gap-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={selected.has(d.department_id)}
                                onChange={(e) => {
                                  const next = new Set(selected)
                                  if (e.target.checked) next.add(d.department_id)
                                  else next.delete(d.department_id)
                                  setSelected(next)
                                }}
                              />
                              {d.name}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="h-7 px-2 text-xs"
                            disabled={busyId === row.user_id}
                            onClick={() => saveDepartments(row.user_id)}
                          >
                            Save
                          </Button>
                          <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingDeptsFor(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.user_departments.length === 0 && <span className="text-slate-400">None</span>}
                        {row.user_departments.map((ud) => (
                          <span
                            key={ud.departments.department_id}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {ud.departments.name}
                          </span>
                        ))}
                        <button
                          onClick={() => openDeptEditor(row)}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {row.roles.name}
                    {row.departments_managed.length > 0 && (
                      <p className="text-xs text-slate-400">Manages {row.departments_managed.map((d) => d.name).join(', ')}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        disabled={busyId === row.user_id}
                        onClick={() => resetAccess(row.user_id, row.full_name)}
                      >
                        Reset access
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        disabled={busyId === row.user_id}
                        onClick={() => toggleStatus(row.user_id)}
                      >
                        {row.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No staff yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} buildHref={buildHref} />}
      </Card>
    </div>
  )
}
