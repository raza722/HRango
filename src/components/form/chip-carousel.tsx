import { type KeyboardEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'

import { useElementWidth } from '@/hooks/use-element-width'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

export interface ChipCarouselItem<TValue extends string | number> {
  value: TValue
  label: string
}

export interface ChipCarouselProps<TValue extends string | number> {
  items: readonly ChipCarouselItem<TValue>[]
  value: TValue
  onChange: (value: TValue) => void
  /** Accessible name of the group, e.g. "Month". */
  label: string
  /** Most chips shown at once; fewer are shown when the row is narrower. */
  visibleCount?: number
  disabled?: boolean
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const stepperClassName =
  'shrink-0 rounded-sm p-0.5 text-heading transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-30 sm:p-1'

/**
 * Rendered sizes in rem (keep in sync with the classes above and below).
 * rem, not px, because the whole UI scales up on large monitors.
 */
const SIZES = {
  xs: { chevron: 1.75, gap: 0.25, chip: 3.5 },
  sm: { chevron: 2, gap: 0.75, chip: 4.375 },
} as const

/** Current root font size in px (16 by default, up to 20 on large monitors). */
function rootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/** How many chips fit next to the two steppers in a row `widthPx` wide. */
function chipsThatFit(widthPx: number, size: (typeof SIZES)[keyof typeof SIZES]): number {
  const width = widthPx / rootFontSize()
  const available = width - 2 * size.chevron - 2 * size.gap
  return Math.floor((available + size.gap) / (size.chip + size.gap))
}

/** First visible index that keeps `selected` inside a window of `count` items. */
function windowStartFor(selected: number, start: number, count: number, total: number): number {
  let next = start
  if (selected < next) next = selected
  if (selected >= next + count) next = selected - count + 1
  return clamp(next, 0, Math.max(0, total - count))
}

/**
 * Single-select row of chips with « » steppers, as drawn for the month and day
 * pickers in the Warning Section design. Shows a sliding window of as many
 * chips as fit the row (up to `visibleCount`), so it never overflows a phone.
 * Keyboard: ←/→ move the selection, Home/End jump to the ends.
 */
export function ChipCarousel<TValue extends string | number>({
  items,
  value,
  onChange,
  label,
  visibleCount = 5,
  disabled = false,
  className,
}: ChipCarouselProps<TValue>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [rowRef, rowWidth] = useElementWidth()
  const isSmUp = useMediaQuery(BREAKPOINTS.sm)
  // Until the row is measured, assume the design's 5 (3 on phones).
  const fit =
    rowWidth === undefined
      ? isSmUp
        ? visibleCount
        : 3
      : chipsThatFit(rowWidth, isSmUp ? SIZES.sm : SIZES.xs)
  const count = clamp(fit, 1, Math.min(visibleCount, items.length))
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )

  // Open with the selected chip near the middle (the design shows "Apr" among Jan–May).
  const [windowStart, setWindowStart] = useState(() =>
    windowStartFor(selectedIndex, selectedIndex - Math.floor(count / 2), count, items.length),
  )
  // Derived, so an outside change of `value` (form reset) still scrolls into view.
  const start = windowStartFor(selectedIndex, windowStart, count, items.length)
  const visible = items.slice(start, start + count)

  const select = (index: number, focus = false) => {
    const target = items[clamp(index, 0, items.length - 1)]
    if (!target) return
    const nextIndex = items.indexOf(target)
    flushSync(() => {
      setWindowStart(windowStartFor(nextIndex, start, count, items.length))
      onChange(target.value)
    })
    if (focus) {
      groupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: selectedIndex - 1,
      ArrowRight: selectedIndex + 1,
      Home: 0,
      End: items.length - 1,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next, true)
  }

  return (
    <div
      ref={rowRef}
      className={cn('flex w-full items-center justify-center gap-1 sm:gap-3', className)}
    >
      <button
        type="button"
        aria-label={`Previous ${label.toLowerCase()}`}
        disabled={disabled || selectedIndex === 0}
        onClick={() => {
          select(selectedIndex - 1)
        }}
        className={stepperClassName}
      >
        <ChevronsLeft className="size-6" strokeWidth={1.75} />
      </button>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 sm:gap-3"
      >
        {visible.map((item) => {
          const checked = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => {
                select(items.indexOf(item))
              }}
              className={cn(
                'h-8 w-14 shrink-0 rounded-sm border border-chip px-1 text-[0.8125rem] whitespace-nowrap text-chip-foreground transition-colors outline-none sm:w-[4.375rem] sm:text-sm',
                'hover:text-chip-active-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 pointer-coarse:h-10',
                checked && 'bg-chip text-chip-active-foreground',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        aria-label={`Next ${label.toLowerCase()}`}
        disabled={disabled || selectedIndex === items.length - 1}
        onClick={() => {
          select(selectedIndex + 1)
        }}
        className={stepperClassName}
      >
        <ChevronsRight className="size-6" strokeWidth={1.75} />
      </button>
    </div>
  )
}
