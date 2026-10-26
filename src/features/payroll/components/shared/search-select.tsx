import { type ReactNode, useId, useMemo, useState } from 'react'
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
 * (employees, pay items, time slots, payrolls).
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

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
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
            aria-label={`Search ${placeholder.replace(/^Select /, '').toLowerCase()}`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
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
          className="grid scrollbar-thin max-h-64 gap-0.5 overflow-y-auto"
        >
          {clearable && (
            <button
              type="button"
              role="option"
              aria-selected={!selected}
              onClick={() => {
                pick(null)
              }}
              className="rounded-sm px-2.5 py-1.5 text-left text-sm text-label outline-none hover:bg-muted focus-visible:bg-muted"
            >
              {placeholder}
            </button>
          )}
          {shown.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : 'Nothing matches.'}
            </p>
          ) : (
            shown.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    pick(option.value)
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-field-foreground outline-none hover:bg-muted focus-visible:bg-muted',
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
