import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardBody, cn } from '@roomlink/ui'

const COLOR_CLASSES = {
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  amber: 'bg-amber-500 text-white',
  purple: 'bg-purple-600 text-white',
  red: 'bg-red-600 text-white',
} as const

/**
 * Front Office Dashboard's top KPI row — same underlying data as `KpiCard`
 * elsewhere in the app, but styled with a solid colored icon tile to match
 * the requested mockup. Kept local to this page rather than changing the
 * shared `KpiCard` (which only supports default/warning/critical tones and
 * is used unchanged by every other role's dashboard).
 */
export function StatTile({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
  href,
}: {
  label: string
  value: number
  sublabel: string
  icon: LucideIcon
  color: keyof typeof COLOR_CLASSES
  href?: string
}) {
  const tile = (
    <Card className={cn('h-full', href && 'transition-shadow hover:shadow-md hover:border-brand-300')}>
      <CardBody className="flex items-start gap-3.5">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', COLOR_CLASSES[color])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          <p className="truncate text-sm font-medium text-slate-800">{label}</p>
          <p className="truncate text-xs text-slate-500">{sublabel}</p>
        </div>
      </CardBody>
    </Card>
  )

  if (!href) return tile

  return (
    <Link href={href} className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {tile}
    </Link>
  )
}
