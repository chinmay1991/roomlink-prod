import { NextResponse } from 'next/server'
import { requireGuestSession } from '@/server/require-guest-session'
import { getNewestStaffMessageSignal } from '@/server/services/conversations.service'
import { toErrorResponse } from '@/server/api-error'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await requireGuestSession()
    const signal = await getNewestStaffMessageSignal(ctx)
    return NextResponse.json(signal)
  } catch (error) {
    return toErrorResponse(error)
  }
}
