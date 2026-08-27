'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@roomlink/ui'

/**
 * Shared prev/numbered/next pager — originally the Reception Dashboard's
 * per-floor pager, extracted once building-then-floor grouping meant
 * multiple screens each needed two of these stacked (a building pager above
 * a floor pager). `min-w-10` (not a fixed width) so it still looks like a
 * tight pill for short floor numbers but doesn't clip longer building names.
 */
export function Pager({
  items,
  currentIndex,
  onSelect,
}: {
  items: { key: string; label: string }[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  if (items.length <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(Math.max(0, currentIndex - 1))}
        disabled={currentIndex <= 0}
        aria-label="Previous"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors',
          currentIndex <= 0 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-200'
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      {items.map((item, idx) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(idx)}
          aria-current={idx === currentIndex ? 'true' : undefined}
          aria-label={item.label}
          className={cn(
            'flex h-10 min-w-10 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors',
            idx === currentIndex
              ? 'border border-slate-900 bg-white text-slate-900'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect(Math.min(items.length - 1, currentIndex + 1))}
        disabled={currentIndex >= items.length - 1}
        aria-label="Next"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors',
          currentIndex >= items.length - 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-200'
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
