import { type ReactNode, useId } from 'react'
import { Link } from '@tanstack/react-router'
import { CloudOff, FlaskConical, LayoutGrid, Lock } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { isMockApi } from '@/lib/env'
import { cn } from '@/lib/utils'

import { chartVars, dash } from './dashboard-styles'

/**
 * A dashboard page: a hero card (eyebrow, title, what it covers, its pickers, and the key figures
 * under them), then the widgets. Sets the chart colour variables for everything inside.
 */
export function DashboardShell({
  title,
  eyebrow,
  description,
  controls,
  figures,
  children,
}: {
  title: ReactNode
  eyebrow: string
  description: ReactNode
  controls?: ReactNode
  /** The row of stat tiles in the hero. */
  figures?: ReactNode
  children?: ReactNode
}) {
  return (
    <PageContainer className={chartVars}>
      <header
        className={cn(
          dash.card,
          'relative isolate overflow-hidden rounded-[1.25rem] px-4 py-5 sm:px-7 sm:py-6',
        )}
      >
        <HeroDecoration />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1.5">
            <p className={cn(dash.chip, dash.lavender, 'w-fit font-semibold tracking-wide')}>
              {eyebrow}
            </p>
            <h1 className="text-2xl font-semibold text-title sm:text-[1.625rem]">{title}</h1>
            <div className="max-w-2xl text-sm text-grey">{description}</div>
          </div>
          {controls && (
            <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">{controls}</div>
          )}
        </div>
        {figures && (
          <div className="mt-5 grid grid-cols-2 gap-3 @3xl/page:grid-cols-4 @6xl/page:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
            {figures}
          </div>
        )}
      </header>
      {children}
    </PageContainer>
  )
}

/** Concentric purple rings fading into the hero's top right corner. */
function HeroDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 320"
      className="pointer-events-none absolute -top-28 -right-24 -z-10 size-[22rem] text-[#7127EA] opacity-[0.09] dark:opacity-[0.16]"
    >
      {[150, 118, 86, 54].map((radius) => (
        <circle
          key={radius}
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
        />
      ))}
    </svg>
  )
}

/**
 * The widgets' grid: one column on a phone, twelve on a wide page. While the figures refresh
 * after a change, the previous ones stay, slightly faded (no skeleton flash).
 */
export function DashboardGrid({
  children,
  refreshing = false,
}: {
  children: ReactNode
  refreshing?: boolean
}) {
  return (
    <div
      aria-busy={refreshing || undefined}
      className={cn(
        'grid grid-cols-1 gap-4 transition-opacity duration-300 sm:gap-5 @5xl/page:grid-cols-12',
        refreshing && 'opacity-80',
      )}
    >
      {children}
    </div>
  )
}

/** One key figure in the hero; a button when it opens a list. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  pressed,
  onClick,
  controls,
}: {
  label: string
  value: number | string
  hint?: ReactNode
  icon: ReactNode
  tone?: 'default' | 'danger'
  /** With `onClick`: the tile is a toggle that shows its tasks. */
  pressed?: boolean
  onClick?: () => void
  /** The id of the list the tile shows. */
  controls?: string
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm text-grey">{label}</span>
        <span aria-hidden="true" className={tone === 'danger' ? dash.dangerTile : dash.iconTile}>
          {icon}
        </span>
      </span>
      <span className="mt-1 block text-[1.75rem] leading-none font-semibold text-title">
        {value}
      </span>
      {hint && <span className="mt-2 block text-xs text-grey">{hint}</span>}
    </>
  )
  const frame = cn(
    dash.card,
    'block p-4 text-left',
    onClick &&
      'transition-colors hover:border-[#D9C8FB] hover:bg-[#FCFAFF] dark:hover:border-[#7127EA]/50 dark:hover:bg-white/[0.03]',
    pressed &&
      'border-[#7127EA] bg-[#F8F5FF] ring-1 ring-[#7127EA] dark:border-[#9F7BF3] dark:bg-[#7127EA]/10 dark:ring-[#9F7BF3]',
  )
  if (!onClick) return <div className={frame}>{body}</div>
  return (
    <button
      type="button"
      // Name it as said aloud ("In Progress: 4"); the hint stays visible text.
      aria-label={`${label}: ${String(value)}`}
      aria-pressed={pressed}
      aria-controls={controls}
      onClick={onClick}
      className={cn(frame, dash.focus)}
    >
      {body}
    </button>
  )
}

/** A dashboard card: icon, title (with a count), a line saying what it holds, an action. */
export function Widget({
  title,
  icon,
  description,
  count,
  action,
  badge,
  className,
  children,
  id,
}: {
  title: string
  icon: ReactNode
  description?: ReactNode
  count?: number
  action?: ReactNode
  /** Beside the title: the preview badge of a widget waiting on the backend. */
  badge?: ReactNode
  className?: string
  children: ReactNode
  id?: string
}) {
  const titleId = useId()
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(dash.card, 'flex flex-col gap-4 p-4 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className={dash.iconTile}>
          {icon}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className={dash.title}>
              {title}
              {count !== undefined && <span className="sr-only"> ({count})</span>}
            </h2>
            {count !== undefined && (
              <span aria-hidden="true" className={cn(dash.chip, dash.lavender, 'px-1.5')}>
                {count}
              </span>
            )}
            {badge}
          </div>
          {description && <p className={dash.subtle}>{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

/** A widget with nothing to show: an icon, a sentence, maybe a way forward. */
export function WidgetEmpty({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[0.75rem] border border-dashed border-[#E4DAFB] px-4 py-8 text-center dark:border-border">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-[#F8F5FF] text-[#A181FF] dark:bg-white/5 [&_svg]:size-5"
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-title">{title}</p>
      {children && <div className="max-w-xs text-xs text-grey">{children}</div>}
    </div>
  )
}

/** A widget whose endpoint the backend does not have yet (the real API answered 404). */
export function NotAvailable({ what, dependency }: { what: string; dependency: string }) {
  return (
    <WidgetEmpty icon={<CloudOff />} title="Not available yet">
      {what} need a backend endpoint that does not exist yet (Backend Dependencies {dependency}).
    </WidgetEmpty>
  )
}

/**
 * Beside the title of a widget whose endpoint is pending, once it has data: in mock mode that
 * data is the development mock's sample, which this says.
 */
export function PreviewBadge({ dependency }: { dependency: string }) {
  if (!isMockApi) return null
  return (
    <span
      className={cn(dash.chip, dash.warning)}
      title={`No backend endpoint yet (Backend Dependencies ${dependency}): sample data from the development mock.`}
    >
      <FlaskConical aria-hidden="true" className="size-3" />
      Sample data
      <span className="sr-only">
        : no backend endpoint yet (Backend Dependencies {dependency}); these come from the
        development mock
      </span>
    </span>
  )
}

/** A widget's own load failure, with Try again. */
export function WidgetError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ErrorState
      title="Could not load this"
      message={message}
      onRetry={onRetry}
      className="border border-dashed border-[#F5C2C7] bg-transparent py-6 shadow-none dark:border-[#DC3545]/40 [&_h2]:text-base"
    />
  )
}

/** Rows of grey bars while a widget loads. */
export function WidgetSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-[0.625rem]" />
      ))}
    </div>
  )
}

/** The hero's four stat tiles while the figures load. */
export function FigureSkeletons() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} aria-hidden="true" className={cn(dash.card, 'grid gap-3 p-4')}>
          <span className="flex items-start justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-9 rounded-[0.625rem]" />
          </span>
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </>
  )
}

const SKELETON_CARDS = [
  { key: 'a', span: '@5xl/page:col-span-7', rows: 4 },
  { key: 'b', span: '@5xl/page:col-span-5', rows: 4 },
  { key: 'c', span: '@5xl/page:col-span-5', rows: 3 },
  { key: 'd', span: '@5xl/page:col-span-7', rows: 3 },
]

/** The widgets while the workspaces load: four card shells with pulsing lines. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid grid-cols-1 gap-4 sm:gap-5 @5xl/page:grid-cols-12"
    >
      {SKELETON_CARDS.map((card) => (
        <div key={card.key} className={cn(dash.card, 'grid content-start gap-4 p-5', card.span)}>
          <span className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-[0.625rem]" />
            <span className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </span>
          </span>
          <WidgetSkeleton rows={card.rows} />
        </div>
      ))}
    </div>
  )
}

/** The page-level failure: nothing could be read. */
export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ErrorState
      title="Could not load this dashboard"
      message={message}
      onRetry={onRetry}
      className={cn(dash.card, 'shadow-none')}
    />
  )
}

const noticeLink =
  'mt-1 inline-flex h-10 items-center rounded-xl border border-[#7127EA] px-5 text-sm font-semibold text-[#7127EA] transition-colors outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:border-[#9F7BF3] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/20'

/** A full-width notice in place of the widgets: an icon, a heading, a sentence, a way on. */
export function PageNotice({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode
  title: string
  message: ReactNode
  action?: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(dash.card, 'flex flex-col items-center gap-3 px-6 py-12 text-center')}
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-[#F0E9FD] text-[#7127EA] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF] [&_svg]:size-6"
      >
        {icon}
      </span>
      <h2 id={id} className="text-lg font-semibold text-title">
        {title}
      </h2>
      <div className="max-w-md text-sm text-grey">{message}</div>
      {action}
    </section>
  )
}

/** The caller may not see this dashboard (no permission, or not a member of the workspace). */
export function NoAccess({ title, message }: { title: string; message: string }) {
  return (
    <PageNotice
      icon={<Lock />}
      title={title}
      message={message}
      action={
        <Link to="/project-management/workspaces" className={noticeLink}>
          Go to Workspaces
        </Link>
      }
    />
  )
}

/** Nothing to show yet: the caller has no workspace (offers Create Workspace when allowed). */
export function NoWorkspaces({ canCreate, message }: { canCreate: boolean; message: string }) {
  return (
    <PageNotice
      icon={<LayoutGrid />}
      title="No workspaces yet"
      message={message}
      action={
        canCreate ? (
          <Link
            to="/project-management/workspaces"
            search={{ create: true }}
            className={cn(
              noticeLink,
              'border-transparent bg-[#7127EA] text-white hover:bg-[#5f1fd0] dark:bg-[#7127EA] dark:text-white',
            )}
          >
            Create Workspace
          </Link>
        ) : undefined
      }
    />
  )
}

/** "Covers 3 workspaces" under the hero, with any that could not be read. */
export function CoverageNote({
  covered,
  failed,
  what = 'workspace',
}: {
  covered: number
  failed: readonly { name: string }[]
  what?: string
}) {
  return (
    <span>
      Covers {covered} {covered === 1 ? what : `${what}s`} you can open.
      {failed.length > 0 && (
        <span className="text-[#B7192C] dark:text-[#FF9AA3]">
          {' '}
          Could not read {failed.map((entry) => entry.name).join(', ')}; left out of the figures.
        </span>
      )}
    </span>
  )
}
