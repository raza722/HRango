import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { fieldControlClassName, FormField } from '@/components/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { fieldValueText } from '../../utils/styles'

const PAGE = 12

interface YearPickerProps {
  id?: string
  /** `yyyy`, or '' for none. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Latest year that can be picked. */
  max?: number | undefined
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** A year field with the calendar icon, as drawn; it opens twelve years at a time. */
export function YearPicker({
  id,
  value,
  onChange,
  placeholder = '',
  disabled = false,
  max,
  className,
  ...aria
}: YearPickerProps) {
  const [open, setOpen] = useState(false)
  const latest = max ?? new Date().getFullYear()
  // The page ends at the chosen year (or the latest one), so it is always in view.
  const [last, setLast] = useState(() => (value ? Number(value) : latest))
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setLast(value ? Math.max(Number(value), latest) : latest)
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
            {value || placeholder}
          </span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-heading" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Earlier years"
            onClick={() => {
              setLast((current) => current - PAGE)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium text-heading">
            {last - PAGE + 1} – {last}
          </span>
          <button
            type="button"
            aria-label="Later years"
            disabled={last >= latest}
            onClick={() => {
              setLast((current) => current + PAGE)
            }}
            className="flex size-7 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: PAGE }, (_, index) => last - PAGE + 1 + index).map((year) => {
            const selected = String(year) === value
            return (
              <button
                key={year}
                type="button"
                disabled={year > latest}
                aria-pressed={selected}
                onClick={() => {
                  onChange(String(year))
                  setOpen(false)
                }}
                className={cn(
                  'h-8 rounded text-sm text-field-foreground hover:bg-muted disabled:opacity-40',
                  selected && 'bg-[#17263A] text-white hover:bg-[#17263A] dark:bg-primary',
                )}
              >
                {year}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface YearFieldProps<T extends FieldValues, N extends FieldPathByValue<T, string>> {
  control: Control<T>
  name: N
  label: ReactNode
  required?: boolean
  disabled?: boolean
  max?: number
  className?: string
}

export function YearField<T extends FieldValues, N extends FieldPathByValue<T, string>>({
  control,
  name,
  label,
  required,
  disabled,
  max,
  className,
}: YearFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <YearPicker
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
