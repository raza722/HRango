import { useId, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

import { fieldControlClassName } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MultiOption {
  value: string
  label: string
}

/**
 * A field that picks several values: the button lists what is chosen, the
 * popover has a search box and a checkbox per option.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Enter',
  className,
  onQueryChange,
  loading = false,
  hasMore = false,
  onLoadMore,
}: {
  label: string
  options: readonly MultiOption[]
  value: readonly string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  /** Search on the server: the options are already the matches. */
  onQueryChange?: (query: string) => void
  loading?: boolean
  /** More matches on the server than shown: offers "Load more", which calls `onLoadMore`. */
  hasMore?: boolean
  onLoadMore?: () => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = options.filter((option) => value.includes(option.value))
  const visible = onQueryChange
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length <= 2
        ? chosen.map((option) => option.label).join(', ')
        : `${chosen[0]?.label ?? ''} +${chosen.length - 1} more`

  return (
    <div className={cn('grid min-w-0 gap-2', className)}>
      <label htmlFor={id} className="text-sm leading-none text-title">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={
              chosen.length ? `${label}: ${chosen.map((option) => option.label).join(', ')}` : label
            }
            className={cn(fieldControlClassName, 'justify-between gap-2 text-left')}
          >
            <span className={cn('truncate', chosen.length === 0 && 'text-label')}>{summary}</span>
            <ChevronDown className="size-4 shrink-0 text-field-foreground/70" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-56 p-2"
        >
          <div className="relative mb-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-label"
            />
            <Input
              type="search"
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                onQueryChange?.(event.target.value)
              }}
              className="h-8 pl-8 sm:pl-8"
            />
          </div>
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="grid scrollbar-thin max-h-56 gap-0.5 overflow-y-auto"
          >
            {visible.map((option) => {
              const selected = value.includes(option.value)
              return (
                <li key={option.value} role="option" aria-selected={selected}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => {
                        onChange(
                          checked === true
                            ? [...value, option.value]
                            : value.filter((item) => item !== option.value),
                        )
                      }}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                </li>
              )
            })}
            {visible.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                {loading ? 'Loading…' : 'Nothing matches.'}
              </li>
            )}
          </ul>
          {hasMore && onLoadMore && (
            <button
              type="button"
              disabled={loading}
              onClick={onLoadMore}
              className="mt-1 w-full rounded-sm px-2 py-1.5 text-center text-sm font-medium text-primary hover:bg-muted disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
