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
import type { SearchOption } from './search-select'

interface MultiSearchSelectProps {
  id?: string
  value: readonly string[]
  onChange: (value: string[]) => void
  options: readonly SearchOption[]
  placeholder: string
  disabled?: boolean
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
 * `SearchSelect` for several values ("Select Employees"): the list stays open
 * and each pick toggles a tick; the field shows who is chosen.
 */
export function MultiSearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  onSearch,
  loading = false,
  hasMore = false,
  onLoadMore,
  ...aria
}: MultiSearchSelectProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = options.filter((option) => value.includes(option.value))
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase()
    return text && !onSearch
      ? options.filter((option) =>
          `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(text),
        )
      : options
  }, [options, query, onSearch])
  const summary =
    chosen.length <= 2
      ? chosen.map((option) => option.label).join(', ')
      : `${chosen[0]?.label ?? ''} +${String(chosen.length - 1)} more`

  const toggle = (next: string) => {
    onChange(value.includes(next) ? value.filter((item) => item !== next) : [...value, next])
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
          <span className="truncate" data-placeholder={chosen.length === 0 ? '' : undefined}>
            {chosen.length === 0 ? placeholder : summary}
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
          aria-multiselectable="true"
          className="grid scrollbar-thin max-h-64 gap-0.5 overflow-y-auto"
        >
          {shown.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : 'Nothing matches.'}
            </p>
          ) : (
            shown.map((option) => {
              const active = value.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    toggle(option.value)
                  }}
                  className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm text-field-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[0.1875rem] border border-input',
                      active &&
                        'border-[#17263A] bg-[#17263A] text-white dark:border-primary dark:bg-primary',
                    )}
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                  </span>
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

interface MultiSearchSelectFieldProps<
  T extends FieldValues,
  N extends FieldPathByValue<T, string[]>,
> {
  control: Control<T>
  name: N
  label: ReactNode
  options: readonly SearchOption[]
  placeholder: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/** `MultiSearchSelect` as a form field (label, error, required mark). */
export function MultiSearchSelectField<
  T extends FieldValues,
  N extends FieldPathByValue<T, string[]>,
>({
  control,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  className,
}: MultiSearchSelectFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <MultiSearchSelect
          {...a11y}
          value={field.value}
          onChange={field.onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </FormField>
  )
}
