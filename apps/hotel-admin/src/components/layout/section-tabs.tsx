'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@roomlink/ui'

const SECTIONS = {
  hotel: [
    { href: '/hotel/profile', label: 'Profile' },
    { href: '/hotel/legal', label: 'Legal & GST' },
    { href: '/hotel/departments', label: 'Departments' },
    { href: '/hotel/rooms', label: 'Rooms' },
    { href: '/hotel/qr-codes', label: 'QR Codes' },
  ],
  people: [
    { href: '/hotel/staff', label: 'Staff' },
    { href: '/hotel/managers', label: 'Department Managers' },
    { href: '/hotel/reception', label: 'Reception' },
  ],
  'guest-services': [
    { href: '/hotel/services', label: 'Services' },
    { href: '/hotel/requests', label: 'Requests' },
    { href: '/hotel/menu', label: 'Restaurant Menu' },
  ],
  operations: [
    { href: '/hotel/activity', label: 'Activity' },
    { href: '/hotel/notifications', label: 'Notifications' },
  ],
} as const

export function SectionTabs({ section }: { section: keyof typeof SECTIONS }) {
  const pathname = usePathname()
  const tabs = SECTIONS[section]

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
