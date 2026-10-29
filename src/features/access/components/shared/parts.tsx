import { type ReactNode, type SyntheticEvent, useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Info, Search, ShieldAlert, X } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { isMockApi } from '@/lib/env'
import { cn } from '@/lib/utils'

import { PASSWORD_RULES } from '../../schemas/password.schema'
import {
  cardClass,
  cardTitleClass,
  chipClass,
  chipTone,
  navyButtonClass,
  pageTitleClass,
  sectionCardClass,
  toolbarButtonClass,
} from '../../utils/styles'

/** A status chip: its text in the status colour (never the colour alone). */
export function Chip({
  tone,
  children,
  icon,
  title,
}: {
  tone: keyof typeof chipTone
  children: ReactNode
  icon?: ReactNode
  title?: string
}) {
  return (
    <span title={title} className={cn(chipClass, chipTone[tone])}>
      {icon}
      {children}
    </span>
  )
}

/** "Sensitive", with the reason in its title for pointer users (the hint is written out too). */
export function SensitiveChip() {
  return (
    <Chip
      tone="amber"
      icon={<ShieldAlert aria-hidden="true" className="size-3" strokeWidth={2.2} />}
      title="Sensitive: pay, salary or access"
    >
      Sensitive
    </Chip>
  )
}

/** The white card at the top of a page: the title, a line under it and the page's buttons. */
export function PageHeaderCard({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className={cn(cardClass, 'grid gap-3 px-4 py-4 sm:px-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className={cn(pageTitleClass, 'break-words')}>{title}</h1>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** A titled card inside a page or tab. */
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
  return (
    <p role="status" className="py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
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

/** A read that failed: the API's message and Try again (never an empty list). */
export function LoadError({
  error,
  what,
  onRetry,
}: {
  error: unknown
  what: string
  onRetry: () => void
}) {
  const message =
    error instanceof ApiError && error.status === 403
      ? `You do not have permission to see ${what}.`
      : error instanceof ApiError
        ? error.message
        : `The ${what} could not be loaded.`
  return (
    <ErrorState
      title={`Could not load ${what}`}
      message={message}
      onRetry={onRetry}
      className="shadow-none"
    />
  )
}

/** Label / value pairs in a grid that follows the card's width. */
export function Facts({
  items,
  label,
  className,
}: {
  items: readonly { label: string; value: ReactNode }[]
  label: string
  className?: string
}) {
  return (
    <dl
      aria-label={label}
      className={cn('grid gap-x-6 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3', className)}
    >
      {items.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-0.5">
          <dt className="text-[0.6875rem] text-grey">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words text-title">{item.value}</dd>
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
  className,
}: {
  value: string | undefined
  onSearch: (q: string | undefined) => void
  label: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value ?? '')
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(text.trim() || undefined)
  }
  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={submit}
      className={cn('flex min-w-0 flex-1 gap-2 sm:max-w-md', className)}
    >
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        className="h-9 min-w-0 flex-1"
      />
      <Button type="submit" className={cn(toolbarButtonClass, navyButtonClass, 'gap-2')}>
        <Search aria-hidden="true" className="size-4" />
        Search
      </Button>
    </form>
  )
}

/**
 * Toggle chips (All / Active / Disabled …): the chosen one filled. Each is a button named by
 * its text with `aria-pressed`, so the choice never rests on colour alone.
 */
export function ChipToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T | undefined; label: string }[]
  value: T | undefined
  onChange: (value: T | undefined) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(option.value)
            }}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
              selected
                ? 'border-sidebar bg-sidebar text-white dark:border-primary dark:bg-primary'
                : 'border-border bg-card text-field-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** "Clear filters (2)". */
export function ClearFilters({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClear}
      className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-heading"
    >
      <X aria-hidden="true" className="size-3.5" />
      Clear filters ({count})
    </Button>
  )
}

/** "← System Users" above a detail page. */
export function BackLink({
  to,
  label,
}: {
  to: '/settings/system-users' | '/settings/user-group-permissions'
  label: string
}) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-sidebar outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-heading"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  )
}

/** In mock mode: the demo user's own access does not follow these screens. */
export function MockModeNote() {
  if (!isMockApi) return null
  return (
    <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Sample data. In mock mode the signed-in demo user can use every screen whatever roles or
        overrides you give it here; against the API, the changes decide what people see.
      </span>
    </p>
  )
}

/** The strength rules under a new-password field, each ticked as it is met. */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  return (
    <ul id={id} aria-label="Password rules" className="grid gap-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1.5',
              met ? 'text-[#2E9E48] dark:text-green-400' : 'text-muted-foreground',
            )}
          >
            {met ? (
              <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            ) : (
              <span aria-hidden="true" className="inline-block size-3.5 text-center leading-none">
                ·
              </span>
            )}
            {rule.label}
            <span className="sr-only">{met ? ' (met)' : ' (not yet)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
