import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { Check, ChevronDown, Search } from 'lucide-react'

import { fieldControlClassName, FormField } from '@/components/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { fieldValueText } from '../../utils/styles'

export interface SearchOption {
  value: string
  label: string
  /** A second line (code, designation…). */
  hint?: string
}

interface SearchSelectProps {
  id?: string
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: readonly SearchOption[]
  placeholder: string
  disabled?: boolean
  /** Offer "placeholder" as a choice that clears the value (filters). */
  clearable?: boolean
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
  /**
   * Search on the server: called with the typed text (the caller debounces and passes the
   * matches as `options`), and the list is not filtered here.
   */
  onSearch?: ((text: string) => void) | undefined
  /** The server is answering (a search or the next page). */
  loading?: boolean | undefined
  /** More matches than shown: offers "Load more", which calls `onLoadMore`. */
  hasMore?: boolean | undefined
  onLoadMore?: (() => void) | undefined
}

/**
 * The designs' drop-downs: a field that opens a list with a search box on top
 * (employees, pay items, time slots, payrolls). From the search box, the arrow keys move
 * through the choices and Enter picks one; Enter alone picks the only match.
 */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  clearable = false,
  className,
  onSearch,
  loading = false,
  hasMore = false,
  onLoadMore,
  ...aria
}: SearchSelectProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase()
    return text && !onSearch
      ? options.filter((option) =>
          `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(text),
        )
      : options
  }, [options, query, onSearch])

  const [highlight, setHighlight] = useState(-1)
  /** What the arrow keys move through: "placeholder" (clears) first when clearable. */
  const choices: (string | null)[] = [
    ...(clearable ? [null] : []),
    ...shown.map((option) => option.value),
  ]
  const optionId = (index: number) => `${listId}-option-${String(index)}`
  const field = (aria['aria-label'] ?? placeholder.replace(/^Selects*/i, '')).trim()
  const searchLabel = `Search ${field ? field.toLowerCase() : 'options'}`

  // A shorter list (a new search, fewer matches) drops a highlight past its end.
  const activeIndex = highlight < choices.length ? highlight : -1
  // Keep the highlighted choice in view.
  useEffect(() => {
    if (activeIndex < 0) return
    try {
      document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
    } catch {
      // jsdom has no layout to scroll.
    }
    // optionId only depends on listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (choices.length === 0) return
      setHighlight((current) =>
        event.key === 'ArrowDown'
          ? Math.min(choices.length - 1, current + 1)
          : Math.max(0, current - 1),
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const index = activeIndex >= 0 ? activeIndex : shown.length === 1 ? choices.length - 1 : -1
      if (index >= 0 && index < choices.length) pick(choices[index] ?? null)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setHighlight(-1)
        if (!next && query) {
          setQuery('')
          onSearch?.('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          {...aria}
          className={cn(
            fieldControlClassName,
            'justify-between gap-2 text-left',
            fieldValueText,
            className,
          )}
        >
          <span className="truncate" data-placeholder={selected ? undefined : ''}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-field-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-56 p-2">
        <div className="relative mb-2">
          <input
            type="search"
            autoFocus
            aria-label={searchLabel}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            onKeyDown={onSearchKey}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlight(-1)
              onSearch?.(event.target.value)
            }}
            className="h-8 w-full rounded-sm border border-input bg-card pr-8 pl-2.5 text-sm text-field-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2 right-2.5 size-4 text-label"
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label={field || 'Options'}
          aria-busy={loading || undefined}
          className="grid scrollbar-thin max-h-64 gap-0.5 overflow-y-auto"
        >
          {loading && shown.length > 0 && (
            <p role="status" className="px-2.5 py-1 text-xs text-muted-foreground">
              Searching…
            </p>
          )}
          {clearable && (
            <button
              id={optionId(0)}
              type="button"
              role="option"
              aria-selected={!selected}
              onClick={() => {
                pick(null)
              }}
              className={cn(
                'rounded-sm px-2.5 py-1.5 text-left text-sm text-label outline-none hover:bg-muted focus-visible:bg-muted',
                activeIndex === 0 && 'bg-muted',
              )}
            >
              {placeholder}
            </button>
          )}
          {shown.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : 'Nothing matches.'}
            </p>
          ) : (
            shown.map((option, position) => {
              const active = option.value === value
              const index = position + (clearable ? 1 : 0)
              return (
                <button
                  key={option.value}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    pick(option.value)
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-field-foreground outline-none hover:bg-muted focus-visible:bg-muted',
                    index === activeIndex && !active && 'bg-muted ring-1 ring-ring/40',
                    index === activeIndex && active && 'ring-2 ring-ring/60',
                    active &&
                      'bg-[#748897] text-white hover:bg-[#748897] focus-visible:bg-[#748897]',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span
                        className={cn(
                          'block truncate text-xs',
                          active ? 'text-white/80' : 'text-muted-foreground',
                        )}
                      >
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {active && <Check aria-hidden="true" className="size-4 shrink-0" />}
                </button>
              )
            })
          )}
          {hasMore && onLoadMore && (
            <button
              type="button"
              disabled={loading}
              onClick={onLoadMore}
              className="rounded-sm px-2.5 py-1.5 text-center text-sm font-medium text-primary outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface SearchSelectFieldProps<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
> {
  control: Control<T>
  name: N
  label: ReactNode
  options: readonly SearchOption[]
  placeholder: string
  required?: boolean
  disabled?: boolean
  className?: string
  onValueChange?: (value: string | null) => void
  /** Offer the placeholder as a choice that clears the value (sets `null`). */
  clearable?: boolean
  /** Server search (see `SearchSelect`). */
  onSearch?: ((text: string) => void) | undefined
  loading?: boolean | undefined
  hasMore?: boolean | undefined
  onLoadMore?: (() => void) | undefined
}

/** `SearchSelect` as a form field (label, error, required mark). */
export function SearchSelectField<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
>({
  control,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  className,
  onValueChange,
  clearable = false,
  ...server
}: SearchSelectFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <SearchSelect
          {...a11y}
          value={field.value}
          onChange={(next) => {
            field.onChange(next)
            onValueChange?.(next)
          }}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          clearable={clearable}
          {...server}
        />
      )}
    </FormField>
  )
}
