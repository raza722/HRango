import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { format } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { fieldControlClassName, FormField } from '@/components/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { formatMonth } from '../../utils/format'
import { fieldValueText } from '../../utils/styles'

const MONTHS = Array.from({ length: 12 }, (_, index) => format(new Date(2024, index, 1), 'MMM'))

interface MonthPickerProps {
  id?: string
  /** `yyyy-MM`, or '' for none. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Latest month that can be picked (`yyyy-MM`). */
  max?: string | undefined
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** A month field ("March, 2007") with a calendar icon; it opens a year of months. */
export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = 'Select month',
  disabled = false,
  max,
  className,
  ...aria
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() =>
    Number((value || format(new Date(), 'yyyy-MM')).slice(0, 4)),
  )
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setYear(Number((value || format(new Date(), 'yyyy-MM')).slice(0, 4)))
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          {...aria}
          className={cn(
            fieldControlClassName,
            'justify-between gap-2 text-left',
            fieldValueText,
            className,
          )}
        >
          <span className="truncate" data-placeholder={value ? undefined : ''}>
            {value ? formatMonth(value) : placeholder}
          </span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-heading" />
        </button>
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
            <ChevronLeft className="size-4" />
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
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((label, index) => {
            const month = `${year}-${String(index + 1).padStart(2, '0')}`
            const selected = month === value
            const blocked = max !== undefined && month > max
            return (
              <button
                key={month}
                type="button"
                disabled={blocked}
                aria-pressed={selected}
                aria-label={formatMonth(month)}
                onClick={() => {
                  onChange(month)
                  setOpen(false)
                }}
                className={cn(
                  'h-8 rounded text-sm text-field-foreground hover:bg-muted disabled:opacity-40',
                  selected && 'bg-[#17263A] text-white hover:bg-[#17263A] dark:bg-primary',
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

interface MonthFieldProps<T extends FieldValues, N extends FieldPathByValue<T, string>> {
  control: Control<T>
  name: N
  label: ReactNode
  required?: boolean
  disabled?: boolean
  max?: string
  className?: string
}

export function MonthField<T extends FieldValues, N extends FieldPathByValue<T, string>>({
  control,
  name,
  label,
  required,
  disabled,
  max,
  className,
}: MonthFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <MonthPicker
          {...a11y}
          value={field.value ?? ''}
          onChange={field.onChange}
          disabled={disabled}
          max={max}
        />
      )}
    </FormField>
  )
}
