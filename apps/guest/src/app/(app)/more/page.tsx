import Link from 'next/link'
import { ChevronRight, MessageSquareText, Wrench, UtensilsCrossed, Info, UserCircle } from 'lucide-react'
import { Card } from '@roomlink/ui'

const ITEMS = [
  { href: '/front-office', label: 'Contact Front Office', icon: MessageSquareText },
  { href: '/services', label: 'Request Service', icon: Wrench },
  { href: '/menu', label: 'Order Food', icon: UtensilsCrossed },
  { href: '/hotel-info', label: 'Hotel Information', icon: Info },
  { href: '/profile', label: 'Profile', icon: UserCircle },
]

export default function MorePage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">More</h1>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-brand-600" aria-hidden />
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
