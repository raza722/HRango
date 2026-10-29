import { type ReactNode, type SyntheticEvent, useId, useState } from 'react'
import { Search, X } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { btn, toolbarButton } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

/**
 * The filter row inside a list card: search and pickers side by side, wrapping into one column
 * on a phone, with "Clear filters" once something is set.
 */
export function FilterBar({
  children,
  active,
  onClear,
  label,
}: {
  children: ReactNode
  /** Filters in use (Clear shows when there are some). */
  active: number
  onClear: () => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="@container grid gap-3 rounded-lg bg-muted/50 p-3 dark:bg-muted/30"
    >
      <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-4">{children}</div>
      {active > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-heading"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear filters ({active})
          </Button>
        </div>
      )}
    </div>
  )
}

/** One labelled control of a filter row. */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('grid min-w-0 content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-label">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

/**
 * "Search …": applies on Enter or the search button (the URL keeps it). Give it `key={value}`
 * so it shows the URL's text again when that changes elsewhere (Clear filters, Back).
 */
export function SearchBox({
  id,
  value,
  onSearch,
  placeholder,
  label,
}: {
  id?: string
  value: string | undefined
  onSearch: (text: string | undefined) => void
  placeholder: string
  label: string
}) {
  const [text, setText] = useState(value ?? '')
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(text.trim() || undefined)
  }
  return (
    <form role="search" onSubmit={submit} className="flex min-w-0 gap-2">
      <Input
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        className="h-10 min-w-0 flex-1 bg-card"
      />
      <Button
        type="submit"
        aria-label={`Search: ${label}`}
        className={cn(toolbarButton, btn.navy, 'h-10 w-10 shrink-0 px-0')}
      >
        <Search aria-hidden="true" className="size-4" />
      </Button>
    </form>
  )
}

/**
 * Status chips over a list: All plus one per status, the chosen one filled. Each is a toggle
 * button named by its label, so the status never rests on colour alone.
 */
export function StatusFilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  counts?: Partial<Record<T, number>> | undefined
}) {
  const chip = (selected: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
      selected
        ? 'border-sidebar bg-sidebar text-white dark:border-primary dark:bg-primary'
        : 'border-border bg-card text-field-foreground hover:bg-muted',
    )
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={value === undefined}
        onClick={() => {
          onChange(undefined)
        }}
        className={chip(value === undefined)}
      >
        All
      </button>
      {options.map((option) => {
        const count = counts?.[option.value]
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => {
              onChange(value === option.value ? undefined : option.value)
            }}
            className={chip(value === option.value)}
          >
            {option.label}
            {count !== undefined && (
              <span className="rounded-full bg-black/10 px-1.5 text-[0.6875rem] tabular-nums dark:bg-white/15">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A list that could not be read: the API's message and Try again. */
export function ListError({
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

/** "Nothing here yet" inside a card or dialog section. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
