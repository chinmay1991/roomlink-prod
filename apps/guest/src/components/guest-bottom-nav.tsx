'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, ShoppingBag, Bell, Menu as MenuIcon } from 'lucide-react'
import { cn } from '@roomlink/ui'

const ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/more', label: 'More', icon: MenuIcon },
]

/**
 * Guest PRD §32 — the only nav this app has (no desktop-sidebar equivalent;
 * every guest is mobile-first, unconditionally, unlike the Staff app's
 * role-gated bottom bar). "More" opens Front Office/Menu/Hotel Info/Profile —
 * five primary destinations plus an overflow, since the Home screen already
 * covers six actions but PRD §32 recommends five nav slots.
 */
export function GuestBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium',
              active ? 'text-brand-600' : 'text-slate-500'
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
