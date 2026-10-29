import { type ReactNode, useId } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { DashLink } from '../utils/links'

/**
 * One dashboard card: a white panel (the page's card look, `shadow-xs`) with its title, an
 * optional line under it and a link or control on the right. It is a size container, so its
 * content can follow the card's own width.
 */
export function Widget({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        '@container grid min-w-0 content-start gap-4 rounded-xl bg-card p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 id={id} className="text-base font-medium text-title">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A titled group of widgets (Attendance, Workforce …). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-3">
      <h2 id={id} className="px-1 text-sm font-medium text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** "Open payroll →" in a card's corner. */
export function WidgetLink({
  link,
  label,
  name,
}: {
  link: DashLink
  label: string
  name?: string
}) {
  return (
    <Link
      to={link.to}
      params={link.params}
      search={link.search}
      aria-label={name}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-[#a78bfa]"
    >
      {label} <ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  )
}

/** The part of a query a widget's states read. */
export interface QueryState<T> {
  data: T | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => unknown
}

/** A failed read, in place of the widget's content: what failed and Try again. */
export function WidgetError({
  what,
  error,
  onRetry,
}: {
  what: string
  error: Error | null
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="grid justify-items-start gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-heading">
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        {what} could not be loaded.
      </p>
      {error?.message && <p className="text-xs text-muted-foreground">{error.message}</p>}
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCw aria-hidden="true" /> Try again
      </Button>
    </div>
  )
}

/** Nothing to show yet: a short line instead of an empty chart. */
export function WidgetEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/70 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * A widget's content by its query's state: skeletons while loading, the error with Try again
 * (never an empty chart), the empty note, then `children(data)`.
 */
export function WidgetBody<T>({
  query,
  what,
  skeleton = 'chart',
  isEmpty,
  empty,
  children,
}: {
  query: QueryState<T>
  /** "Attendance by month": names the read in the error. */
  what: string
  skeleton?: 'chart' | 'list' | 'figures'
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label={`Loading ${what.toLowerCase()}`} className="grid gap-2">
        {skeleton === 'chart' ? (
          <Skeleton className="h-44 w-full" />
        ) : skeleton === 'list' ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 w-full" />)
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        )}
      </div>
    )
  }
  if (query.isError || query.data === undefined) {
    return (
      <WidgetError
        what={what}
        error={query.error}
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  if (isEmpty?.(query.data)) return <WidgetEmpty>{empty ?? 'Nothing to show yet.'}</WidgetEmpty>
  return <>{children(query.data)}</>
}

/** A figure in a module card: the number over its label. */
export function Figure({
  label,
  value,
  note,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
}) {
  return (
    <div className="grid min-w-0 content-start gap-0.5 rounded-lg bg-muted/60 px-3 py-2">
      <dt className="truncate text-[0.6875rem] text-muted-foreground">{label}</dt>
      <dd className="text-lg leading-tight font-semibold text-heading">{value}</dd>
      {note && <dd className="truncate text-[0.6875rem] text-field-foreground">{note}</dd>}
    </div>
  )
}
