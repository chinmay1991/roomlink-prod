'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@roomlink/ui'

export function MobileForm({ codeValue, hotelName, roomNumber }: { codeValue: string; hotelName: string; roomNumber: string }) {
  const router = useRouter()
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  async function submit() {
    if (mobile.trim().length < 6) return
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    const res = await fetch('/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeValue, mobile }),
    })
    busyRef.current = false
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong. Please try again.')
      return
    }
    router.push('/home')
  }

  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-sm text-slate-500">Welcome to</p>
        <h1 className="text-xl font-semibold text-slate-900">{hotelName}</h1>
        <p className="mt-1 text-sm text-slate-500">Room {roomNumber}</p>
      </div>

      <div className="space-y-2 text-left">
        <label htmlFor="mobile" className="block text-center text-sm font-medium text-slate-700">
          Enter your mobile number
        </label>
        <input
          id="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={busy}
          className="w-full rounded-lg border border-slate-300 px-4 py-4 text-center text-lg font-medium text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          placeholder="+91XXXXXXXXXX"
          aria-label="Mobile number"
        />
        <p className="text-center text-xs text-slate-400">
          Use the mobile number Reception has on file for your stay.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3.5 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button className="w-full" disabled={mobile.trim().length < 6 || busy} onClick={submit}>
        {busy ? 'Verifying…' : 'Continue'}
      </Button>
    </div>
  )
}
