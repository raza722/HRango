import { type ReactNode, type SyntheticEvent, useId, useState } from 'react'
import { AlertTriangle, ArrowLeft, Lock, Search } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import { AllScopeIcon, MyScopeIcon, SubordinatesScopeIcon } from '@/components/icons/scope-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  type ChipMeta,
  GOAL_STATUS_META,
  LOCKED_META,
  metaOf,
  OVERDUE_META,
  SCOPE_LABELS,
} from '../../constants'
import type { GoalStatus, ScopeTab } from '../../types/performance.types'
import {
  cardClass,
  cardTitleClass,
  chipClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  sectionCardClass,
  toolbarButtonClass,
} from '../../utils/styles'

/** A status chip: its label in the status colour (never the colour alone). */
export function Chip({ meta, icon }: { meta: ChipMeta; icon?: ReactNode }) {
  return (
    <span className={cn(chipClass, meta.className)}>
      {icon}
      {meta.label}
    </span>
  )
}

/** A goal's status, with "Overdue" and "Locked" beside it when they apply. */
export function GoalStatusChips({
  status,
  isOverdue,
  isLocked,
}: {
  status: GoalStatus
  isOverdue?: boolean
  isLocked?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Chip meta={metaOf(GOAL_STATUS_META, status)} />
      {isOverdue && (
        <Chip
          meta={OVERDUE_META}
          icon={<AlertTriangle aria-hidden="true" className="size-3" strokeWidth={2.2} />}
        />
      )}
      {isLocked && (
        <Chip
          meta={LOCKED_META}
          icon={<Lock aria-hidden="true" className="size-3" strokeWidth={2.2} />}
        />
      )}
    </span>
  )
}

/** A progress bar with the number written beside it. */
export function ProgressBar({
  value,
  label,
  className,
  max = 100,
  text,
}: {
  value: number | null
  /** What it measures, for screen readers ("Progress of Cut time to hire"). */
  label: string
  className?: string
  max?: number
  /** The number as written beside the bar (default "70%"). */
  text?: string
}) {
  const shown = value === null ? 0 : Math.max(0, Math.min(max, value))
  const share = max > 0 ? (shown / max) * 100 : 0
  return (
    <span className={cn('flex min-w-24 items-center gap-2', className)}>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        aria-valuetext={text ?? (value === null ? 'None' : `${String(Math.round(value))}%`)}
        className="relative h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-[#E9EDF5] dark:bg-muted"
      >
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            share >= 100 ? 'bg-[#2CBD4D]' : 'bg-sidebar dark:bg-primary',
          )}
          style={{ width: `${String(share)}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-xs font-medium text-title tabular-nums">
        {text ?? (value === null ? '—' : `${String(Math.round(value))}%`)}
      </span>
    </span>
  )
}

const TAB_ICONS = { my: MyScopeIcon, team: SubordinatesScopeIcon, all: AllScopeIcon } as const

/**
 * My / Team / All, as the Requests tabs draw them (navy when chosen, Poppins Regular 13
 * otherwise). The shared `ScopeTabs` has no "Team", so this is its look with that tab.
 */
export function ScopeTabsBar({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly ScopeTab[]
  value: ScopeTab
  onChange: (tab: ScopeTab) => void
  label: string
}) {
  if (tabs.length < 2) return null
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab]
        const selected = tab === value
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(tab)
            }}
            className={cn(
              'inline-flex h-8 min-w-[5.25rem] items-center justify-center gap-2 rounded-sm px-4 text-[0.8125rem] font-normal transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
              selected
                ? 'bg-sidebar text-white dark:bg-primary'
                : 'bg-chip text-tab hover:brightness-95 dark:bg-input dark:text-field-foreground',
            )}
          >
            <Icon className="size-4" />
            {SCOPE_LABELS[tab]}
          </button>
        )
      })}
    </div>
  )
}

/** The white card at the top of a page: the title, a line under it and the page's buttons. */
export function PageHeaderCard({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header
      className={cn(
        cardClass,
        'flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6',
      )}
    >
      <div className="min-w-0">
        <h1 className={pageTitleClass}>{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}

/** A titled card inside a page or detail view. */
export function SectionCard({
  title,
  actions,
  children,
  className,
  as: Heading = 'h2',
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  as?: 'h2' | 'h3'
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(sectionCardClass, 'grid min-w-0 content-start gap-3 p-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading id={titleId} className={cardTitleClass}>
          {title}
        </Heading>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** "Nothing here yet" inside a card. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** Placeholder rows while a card loads (inside a white card, so they show). */
export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div aria-busy="true" className="grid gap-2">
      <span className="sr-only">Loading {label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full bg-[#EEF1F7] dark:bg-muted" />
      ))}
    </div>
  )
}

/** Label / value pairs in a grid that follows the card's width. */
export function Facts({
  items,
  className,
}: {
  items: readonly { label: string; value: ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3', className)}>
      {items.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-0.5">
          <dt className="text-[0.6875rem] text-grey">{item.label}</dt>
          <dd className="text-sm break-words text-title">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The list's search: a box and a Search button; the text goes to the URL on submit. Give it
 * `key={q}` so a cleared URL clears the box.
 */
export function SearchBox({
  value,
  onSearch,
  label,
  placeholder = 'Search ...',
}: {
  value: string | undefined
  onSearch: (q: string | undefined) => void
  label: string
  placeholder?: string
}) {
  const [text, setText] = useState(value ?? '')
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(text.trim() || undefined)
  }
  return (
    <form role="search" onSubmit={submit} className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        className="h-9 min-w-0 flex-1"
      />
      <Button
        type="submit"
        className={cn(toolbarButtonClass, navyButtonClass, 'gap-2 px-4 text-xs')}
      >
        <Search aria-hidden="true" className="size-4" />
        Search
      </Button>
    </form>
  )
}

/** "Filter" with the number of filters in use. */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(toolbarButtonClass, outlineButtonClass, 'gap-2 px-4')}
    >
      <FilterSlidersIcon aria-hidden="true" className="size-5" />
      Filter
      {count > 0 && (
        <span className="rounded-full bg-sidebar px-1.5 text-[0.6875rem] text-white dark:bg-primary">
          {count}
          <span className="sr-only"> in use</span>
        </span>
      )}
    </Button>
  )
}

/** "← Back to …" at the top of a detail view shown in place of its list. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-sidebar outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-heading"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

/** "Are you sure?" before a delete or another action that can't be undone. */
export function ConfirmAction({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={destructive ? 'destructive' : 'default'}
      onConfirm={() => {
        onConfirm()
        onClose()
      }}
    />
  )
}
