import { type ReactNode, useId } from 'react'
import { CloudOff, FlaskConical, Lock } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { isMockApi } from '@/lib/env'
import { cn } from '@/lib/utils'

import { BACKEND_DEPENDENCY, type ChipMeta, STATUS_META } from '../../constants'
import type { FormStatus } from '../../types/custom-forms.types'
import { cardClass, cardTitleClass, chipClass, pageTitleClass } from '../../utils/styles'

/** A status chip: the label in the status colour (never colour alone). */
export function Chip({ meta, className }: { meta: ChipMeta; className?: string }) {
  return <span className={cn(chipClass, meta.className, className)}>{meta.label}</span>
}

export function StatusChip({ status }: { status: FormStatus }) {
  return <Chip meta={STATUS_META[status]} />
}

/**
 * Beside a page title while the data comes from the development mock: the backend has no
 * Custom Form endpoints yet, so what the page shows is sample data.
 */
export function SampleDataBadge() {
  if (!isMockApi) return null
  return (
    <span
      className={cn(
        chipClass,
        'min-w-0 bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300',
      )}
      title="Sample data: shown until the server supports forms"
    >
      <FlaskConical aria-hidden="true" className="size-3" />
      Sample data
      <span className="sr-only">: shown until the server supports forms</span>
    </span>
  )
}

/** The white title card at the top of a page, with the sample-data badge and the page's buttons. */
export function PageHeaderCard({
  title,
  badge = true,
  actions,
  children,
}: {
  title: ReactNode
  /** Show "Sample data" (once the page has data from the mock). */
  badge?: boolean
  actions?: ReactNode
  /** Under the title row (a description, a picker). */
  children?: ReactNode
}) {
  return (
    <header className={cn(cardClass, 'grid gap-3 px-4 py-4 sm:px-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className={cn(pageTitleClass, 'break-words')}>{title}</h1>
          {badge && <SampleDataBadge />}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** A titled white card. */
export function SectionCard({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(cardClass, 'grid gap-4 p-4 sm:p-6', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className={cardTitleClass}>
          {title}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** An icon, a sentence and maybe a way forward, in a dashed box. */
export function EmptyBox({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[0.75rem] border border-dashed border-[#D5DCEB] px-4 py-10 text-center dark:border-border',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-[#EBEFF8] text-sidebar dark:bg-white/5 dark:text-heading [&_svg]:size-5"
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-title">{title}</p>
      {children && <div className="max-w-md text-xs leading-relaxed text-grey">{children}</div>}
    </div>
  )
}

/**
 * The page against the real API before it has the Custom Form endpoints (they answered 404):
 * the screen is waiting for the server, not broken and not showing made-up data.
 */
export function WaitingForServer({ what }: { what: string }) {
  return (
    <div role="status" className={cn(cardClass, 'p-4 sm:p-6')}>
      <EmptyBox icon={<CloudOff />} title="Waiting for the server">
        {what} need backend endpoints that do not exist yet (Backend Dependencies,{' '}
        {BACKEND_DEPENDENCY}). This page starts working as soon as the API has them; nothing here is
        lost or broken.
      </EmptyBox>
    </div>
  )
}

/** The page's or card's load failure, with Try again. */
export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return <ErrorState title="Could not load this" message={error.message} onRetry={onRetry} />
}

/** Shown instead of a page the user holds no permission for. */
export function NoAccess({ what }: { what: string }) {
  return (
    <div className={cn(cardClass, 'p-4 sm:p-6')}>
      <EmptyBox icon={<Lock />} title="No access">
        You do not have access to {what}. Ask HR or an administrator if you need it.
      </EmptyBox>
    </div>
  )
}

/** Grey bars while a card loads. */
export function LoadingBlock({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" className="grid gap-2.5">
      <span className="sr-only">Loading {label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
