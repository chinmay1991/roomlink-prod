import Link from 'next/link'
import { Bell as BellIcon, ClipboardList, Info, UtensilsCrossed, Wrench, MessageSquareText } from 'lucide-react'
import { requireGuestPageSession } from '@/server/require-guest-page-session'
import { getMe } from '@/server/services/session.service'
import { Card } from '@roomlink/ui'

const ACTIONS = [
  { href: '/front-office', label: 'Contact Front Office', icon: MessageSquareText },
  { href: '/services', label: 'Request Service', icon: Wrench },
  { href: '/menu', label: 'Order Food', icon: UtensilsCrossed },
  { href: '/requests', label: 'My Requests', icon: ClipboardList },
  { href: '/notifications', label: 'Notifications', icon: BellIcon },
  { href: '/hotel-info', label: 'Hotel Information', icon: Info },
]

/** Guest PRD §8/§9 — extremely simple, six large touch-friendly cards. */
export default async function GuestHomePage() {
  const ctx = await requireGuestPageSession()
  const me = await getMe(ctx)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Welcome to</p>
        <h1 className="text-2xl font-semibold text-slate-900">{me.hotelName}</h1>
        <p className="mt-0.5 text-sm text-slate-500">Room {me.roomNumber}</p>
      </div>

      <p className="text-sm font-medium text-slate-700">How can we help you?</p>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-28 flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50">
              <Icon className="h-6 w-6 text-brand-600" aria-hidden />
              <span className="text-sm font-medium text-slate-800">{label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
