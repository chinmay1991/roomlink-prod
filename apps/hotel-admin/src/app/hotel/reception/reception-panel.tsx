'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardBody, Input, Button, FormField, StatusBadge } from '@roomlink/ui'
import { createReceptionSchema, CreateReceptionInput } from '@/server/validation/staff.schema'

type ReceptionRow = { user_id: string; full_name: string; email: string; employee_id: string | null; status: string }

export function ReceptionPanel({ reception }: { reception: ReceptionRow[] }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; password: string } | null>(null)
  const [lastTempPassword, setLastTempPassword] = useState<{ name: string; password: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateReceptionInput>({ resolver: zodResolver(createReceptionSchema) })

  async function onSubmit(values: CreateReceptionInput) {
    setSubmitting(true)
    const res = await fetch('/api/v1/hotel/reception', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSubmitting(false)
    if (res.ok) {
      const data = await res.json()
      setResult({ email: data.user.email, password: data.tempPassword })
      reset()
      router.refresh()
    }
  }

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

  return (
    <div className="space-y-5">
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
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reception.map((row) => (
                <tr key={row.user_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{row.full_name}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{row.employee_id ?? '—'}</td>
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
              {reception.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                    No Reception users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Add Reception user</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {result && (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Created {result.email} — temporary password: <code className="font-mono">{result.password}</code>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="fullName" required error={errors.fullName?.message}>
              <Input id="fullName" {...register('fullName')} />
            </FormField>
            <FormField label="Employee ID" htmlFor="employeeId" error={errors.employeeId?.message}>
              <Input id="employeeId" {...register('employeeId')} />
            </FormField>
            <FormField label="Mobile" htmlFor="mobile" error={errors.mobile?.message}>
              <Input id="mobile" {...register('mobile')} />
            </FormField>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input id="email" type="email" {...register('email')} />
            </FormField>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Reception user'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
