'use client'

import { useState } from 'react'
import { Card, Input, StatusBadge, formatDateTime } from '@roomlink/ui'

type Result = {
  session_id: string
  status: string
  room: string
  guestName: string | null
  expiresAt: string
  activeRequests: number
  hasRecentConversation: boolean
}

/** Front Office (formerly Reception PRD) §19 — search by room number / guest name / stay id / request id. */
export function GuestSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function runSearch(q: string) {
    setQuery(q)
    if (q.trim().length === 0) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    const res = await fetch(`/api/v1/hotel/front-office/guests?q=${encodeURIComponent(q.trim())}`)
    const data = await res.json()
    setResults(data)
    setLoading(false)
    setSearched(true)
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by room number, guest name, stay ID, or request ID…"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
      />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {results.map((r) => (
            <li key={r.session_id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Room {r.room} {r.guestName ? `— ${r.guestName}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {r.activeRequests} active request{r.activeRequests === 1 ? '' : 's'} · Expires {formatDateTime(r.expiresAt)}
                  {r.hasRecentConversation ? ' · Has conversation' : ''}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
          {searched && !loading && results.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No matching guests found.</li>
          )}
          {!searched && <li className="px-5 py-8 text-center text-sm text-slate-500">Start typing to search.</li>}
        </ul>
      </Card>
    </div>
  )
}
