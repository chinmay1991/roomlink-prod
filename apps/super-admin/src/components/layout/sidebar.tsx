'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  ListChecks,
  LifeBuoy,
  BarChart3,
  Receipt,
  Plug,
  Settings,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hotels', label: 'Hotels', icon: Building2 },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/onboarding', label: 'Onboarding', icon: ListChecks },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
        <Image src="/logo.png" alt="RoomLink" width={128} height={64} className="h-8 w-auto" priority />
        <span className="text-sm font-semibold text-slate-900">Super Admin</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Outside the role/nav-item logic above on purpose — this always renders, for every signed-in user. */}
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
        {process.env.NEXT_PUBLIC_GIT_SHA ? ` · ${process.env.NEXT_PUBLIC_GIT_SHA}` : ''}
      </div>
    </aside>
  )
}
