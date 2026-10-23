import { type ReactNode, useId, useState } from 'react'
import { format } from 'date-fns'

import { Pagination } from '@/components/layout'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/types/api'

import { PAGE_SIZES } from '../../constants'
import { formatDay, formatMonthValue } from '../../utils/format'
import { CalendarIcon, ExpandMoreIcon } from './mp-icons'
import { boxClass, labelText, listBoxClass } from './mp-styles'

/** Value of a select's "none" item (Radix items cannot be ''). */
const NONE = '__none__'

export interface MpOption {
  value: string
  label: string
}

interface A11y {
  id?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/**
 * The designs' select: a light box with the Material chevron. `noneLabel` adds a
 * first item that clears it ("ALL" in Add Planning, "Any" in the filters); with
 * `noneTone="placeholder"` it reads as a placeholder (the popups' grey "Select").
 */
export function MpSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  noneLabel,
  noneTone = 'value',
  disabled,
  className,
  ...a11y
}: A11y & {
  value: string
  onChange: (value: string) => void
  options: readonly MpOption[]
  placeholder?: string
  noneLabel?: string
  noneTone?: 'value' | 'placeholder'
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      value={value === '' ? (noneLabel ? NONE : '') : value}
      disabled={disabled}
      onValueChange={(picked) => {
        onChange(picked === NONE ? '' : picked)
      }}
    >
      <SelectTrigger
        {...a11y}
        data-empty={value === '' && noneTone === 'placeholder' ? '' : undefined}
        className={cn(
          boxClass,
          'w-full data-[empty]:text-[#818CA3] data-[placeholder]:text-[#818CA3] [&>svg:last-child]:hidden',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
        <ExpandMoreIcon aria-hidden="true" className="size-[0.67rem] shrink-0" />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A date box with the calendar_month icon ("1 Jan 2024"). */
export function DateBox({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  minDate,
  maxDate,
  className,
  ...a11y
}: A11y & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string | undefined
  maxDate?: string | undefined
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(value)
  const min = minDate ? parseDateValue(minDate) : undefined
  const max = maxDate ? parseDateValue(maxDate) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        {...a11y}
        className={cn(
          boxClass,
          'flex w-full items-center justify-between gap-2 text-left',
          className,
          !selected && 'text-[#818CA3]',
        )}
      >
        <span className="truncate">{selected ? formatDay(value) : placeholder}</span>
        <CalendarIcon
          aria-hidden="true"
          className="h-[0.94rem] w-[0.81rem] shrink-0 text-[#1C1B1F] dark:text-heading"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? min ?? max}
          disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
          autoFocus
          onSelect={(date) => {
            onChange(date ? toDateValue(date) : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2024, index, 1), 'MMM'),
)

/** A month box ("Jan 2024") with the calendar icon; it opens a year of months. */
export function MonthBox({
  value,
  onChange,
  placeholder = 'Month',
  disabled,
  defaultYear,
  className,
  ...a11y
}: A11y & {
  /** `yyyy-MM`. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** The year the picker opens on when empty. */
  defaultYear?: number | undefined
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const initialYear = () =>
    value ? Number(value.slice(0, 4)) : (defaultYear ?? new Date().getFullYear())
  const [year, setYear] = useState(initialYear)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setYear(initialYear())
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={disabled}
        {...a11y}
        className={cn(
          boxClass,
          'flex w-full items-center justify-between gap-1.5 px-2 text-left text-xs sm:px-2 sm:text-xs',
          className,
          !value && 'text-[#818CA3]',
        )}
      >
        <span className="truncate">{value ? formatMonthValue(value) : placeholder}</span>
        <CalendarIcon
          aria-hidden="true"
          className="h-[0.94rem] w-[0.81rem] shrink-0 text-[#1C1B1F] dark:text-heading"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous year"
            onClick={() => {
              setYear((current) => current - 1)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted"
          >
            <ExpandMoreIcon aria-hidden="true" className="h-1.5 w-2.5 rotate-90" />
          </button>
          <span className="text-sm font-medium text-heading">{year}</span>
          <button
            type="button"
            aria-label="Next year"
            onClick={() => {
              setYear((current) => current + 1)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted"
          >
            <ExpandMoreIcon aria-hidden="true" className="h-1.5 w-2.5 -rotate-90" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_LABELS.map((label, index) => {
            const month = `${String(year)}-${String(index + 1).padStart(2, '0')}`
            const selected = month === value
            return (
              <button
                key={month}
                type="button"
                aria-pressed={selected}
                aria-label={formatMonthValue(month)}
                onClick={() => {
                  onChange(month)
                  setOpen(false)
                }}
                className={cn(
                  'h-8 rounded text-sm text-heading hover:bg-muted',
                  selected && 'bg-[#7469E8] text-white hover:bg-[#7469E8]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** A year box ("2024") with the calendar icon; it opens twelve years to pick from. */
export function YearBox({
  value,
  onChange,
  placeholder = 'Year',
  className,
  ...a11y
}: A11y & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const start = () => (Number(value) || new Date().getFullYear()) - 5
  const [first, setFirst] = useState(start)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setFirst(start())
      }}
    >
      <PopoverTrigger
        type="button"
        {...a11y}
        className={cn(
          boxClass,
          'flex w-full items-center justify-between gap-2 text-left',
          className,
          !value && 'text-[#818CA3]',
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <CalendarIcon
          aria-hidden="true"
          className="h-[0.94rem] w-[0.81rem] shrink-0 text-[#1C1B1F] dark:text-heading"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Earlier years"
            onClick={() => {
              setFirst((current) => current - 12)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted"
          >
            <ExpandMoreIcon aria-hidden="true" className="h-1.5 w-2.5 rotate-90" />
          </button>
          <span className="text-sm font-medium text-heading">
            {first} – {first + 11}
          </span>
          <button
            type="button"
            aria-label="Later years"
            onClick={() => {
              setFirst((current) => current + 12)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted"
          >
            <ExpandMoreIcon aria-hidden="true" className="h-1.5 w-2.5 -rotate-90" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, index) => String(first + index)).map((year) => (
            <button
              key={year}
              type="button"
              aria-pressed={year === value}
              onClick={() => {
                onChange(year === value ? '' : year)
                setOpen(false)
              }}
              className={cn(
                'h-8 rounded text-sm text-heading hover:bg-muted',
                year === value && 'bg-[#7469E8] text-white hover:bg-[#7469E8]',
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * A label above its control (Poppins Medium 14 #000), or beside it in the popups,
 * with the red asterisk and the field's error under it.
 */
export function MpField({
  label,
  required,
  error,
  layout = 'stacked',
  className,
  labelClassName,
  children,
}: {
  label: ReactNode
  required?: boolean
  error?: string | undefined
  layout?: 'stacked' | 'inline'
  className?: string
  labelClassName?: string
  children: (a11y: Required<Pick<A11y, 'id' | 'aria-invalid'>> & A11y) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  const control = children({
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? errorId : undefined,
  })
  return (
    <div
      className={cn(
        'grid min-w-0 content-start gap-3',
        layout === 'inline' &&
          'gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,14.1875rem)] @md:items-center @md:gap-x-4',
        className,
      )}
    >
      <label htmlFor={id} className={cn(labelText, labelClassName)}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-[#D33300]">
            *
          </span>
        )}
      </label>
      <div className="grid min-w-0 gap-1.5">
        {control}
        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

/** "Show: [10] entries", as drawn above the lists. */
export function ShowEntries({
  value,
  onChange,
}: {
  value: number
  onChange: (size: number) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 text-sm text-heading">
      <label htmlFor={id}>Show:</label>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          onChange(Number(next))
        }}
      >
        <SelectTrigger
          id={id}
          aria-label="Entries shown"
          className={cn(listBoxClass, 'w-[5.625rem] px-2 sm:px-2 [&>svg:last-child]:hidden')}
        >
          <SelectValue />
          <ExpandMoreIcon aria-hidden="true" className="size-[0.67rem] shrink-0" />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>entries</span>
    </div>
  )
}

/** "Search: [Search here…]". */
export function SearchBox({
  value,
  onChange,
  label = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 text-sm text-heading">
      <label htmlFor={id}>Search:</label>
      <input
        id={id}
        type="search"
        aria-label={label}
        value={value}
        placeholder="Search here..."
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className={cn(listBoxClass, 'w-[8.5625rem] min-w-0 px-2.5')}
      />
    </div>
  )
}

/** "Showing 1 to 10 of 12 entries" and the pager, once there is more than one page. */
export function MpListFooter({
  meta,
  disabled,
  onPageChange,
}: {
  meta: PaginationMeta | undefined
  disabled?: boolean
  onPageChange: (page: number) => void
}) {
  if (!meta || meta.total <= meta.pageSize) return null
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
      <p className="text-sm text-[#707070] dark:text-muted-foreground">
        Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
        {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} entries
      </p>
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        disabled={disabled}
        onPageChange={onPageChange}
        currentClassName="bg-[#7469E8] text-white"
      />
    </div>
  )
}
