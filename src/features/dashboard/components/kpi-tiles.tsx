import { type ComponentType, type ReactNode, type SVGProps, useId } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowDownRight, ArrowRight, ArrowUpRight, RotateCw } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { DashLink } from '../utils/links'
import { WidgetError } from './widget'

export interface KpiDelta {
  /** "+2", "−1", "0". */
  text: string
  /** "vs September". */
  against: string
  direction: 'up' | 'down' | 'flat'
}

export interface KpiTileProps {
  label: string
  /** The formatted figure. */
  value: string
  note?: ReactNode
  delta?: KpiDelta | undefined
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** The list the tile opens; without it (no access to the list) the tile is plain. */
  link?: DashLink | undefined
  loading?: boolean
  /** The tile's own read failed: say so, with Try again. */
  onRetry?: (() => void) | undefined
}

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const

/**
 * One key figure: the label, the number (proportional figures), a line under it and, where the
 * API gives last month too, the change against it. Deltas stay in the text colours: whether up
 * is good depends on the figure, so the arrow and the sign carry it.
 */
export function KpiTile({
  label,
  value,
  note,
  delta,
  icon: Icon,
  link,
  loading,
  onRetry,
}: KpiTileProps) {
  const noteId = useId()
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null
  const hasNote = Boolean(note) || delta !== undefined
  if (onRetry) {
    return (
      <li className="min-w-0">
        <div
          role="alert"
          className="grid h-full content-start gap-1 rounded-xl bg-card p-4 shadow-xs"
        >
          <span className="text-xs break-words text-muted-foreground">{label}</span>
          <span className="text-sm text-heading">Could not be loaded.</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 justify-self-start rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-[#c4b5fd]"
          >
            <RotateCw aria-hidden="true" className="size-3" /> Try again
          </button>
        </div>
      </li>
    )
  }
  const body = (
    <>
      <span
        aria-hidden="true"
        className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary @[11rem]:flex dark:bg-primary/20 dark:text-[#c4b5fd]"
      >
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-xs break-words text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <span className="text-2xl leading-tight font-semibold text-heading">{value}</span>
        )}
        {!loading && hasNote && (
          <span id={noteId} className="grid gap-0.5 text-xs text-field-foreground">
            {note && <span className="break-words">{note}</span>}
            {delta && DeltaIcon && (
              <span className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] text-muted-foreground">
                <DeltaIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="font-medium text-field-foreground tabular-nums">{delta.text}</span>
                <span>{delta.against}</span>
              </span>
            )}
          </span>
        )}
      </span>
    </>
  )
  const tileClass = 'flex h-full min-w-0 items-start gap-3 rounded-xl bg-card p-4 shadow-xs'
  return (
    // A size container: on a narrow tile (two across a phone) the icon gives its room to the text.
    <li className="@container min-w-0">
      {link && !loading ? (
        <Link
          to={link.to}
          params={link.params}
          search={link.search}
          aria-label={`${label}: ${value}`}
          aria-describedby={hasNote ? noteId : undefined}
          className={cn(
            tileClass,
            'transition-shadow outline-none hover:shadow-md hover:ring-1 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring/60',
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={tileClass}>{body}</div>
      )}
    </li>
  )
}

const ROW_COLUMNS = {
  // Eight figures: 2 across on a phone, 4 from 42rem of page width, one row from 96rem.
  eight: 'grid-cols-2 @2xl/page:grid-cols-4 @[96rem]/page:grid-cols-8',
  // Six figures: 2, then 3 from 42rem, one row from 80rem.
  six: 'grid-cols-2 @2xl/page:grid-cols-3 @7xl/page:grid-cols-6',
} as const

/**
 * The row of key figures, by the page's width. `error` stands in for the tiles a failed read
 * feeds: one error with Try again, while the tiles from other reads stay.
 */
export function KpiRow({
  label,
  columns = 'eight',
  children,
  error,
}: {
  label: string
  columns?: keyof typeof ROW_COLUMNS
  children: ReactNode
  error?: { what: string; error: Error | null; onRetry: () => void } | undefined
}) {
  return (
    <ul aria-label={label} className={cn('grid gap-3 sm:gap-4', ROW_COLUMNS[columns])}>
      {error && (
        <li className="col-span-full">
          <WidgetError what={error.what} error={error.error} onRetry={error.onRetry} />
        </li>
      )}
      {children}
    </ul>
  )
}
