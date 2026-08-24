'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Front Office (formerly Reception PRD) §27 — "if realtime infrastructure is not yet implemented,
 * implement the minimum reliable polling/fetch strategy for V1." No
 * websocket/SSE infra exists anywhere in this codebase, so this is exactly
 * that minimum: re-run the page's server-side data fetch on an interval.
 * Renders nothing — drop it into any server component page that should
 * stay reasonably live without a manual refresh.
 */
export function PollingRefresh({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalSeconds * 1000)
    return () => clearInterval(id)
  }, [router, intervalSeconds])

  return null
}
