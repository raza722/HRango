import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { FormField } from './form-field'
import { fieldControlClassName } from './styles'
import { toInputValue } from './utils'

export interface DatePickerFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  placeholder?: string
  description?: ReactNode
  required?: boolean
  disabled?: boolean
  /** Earliest selectable date. */
  minDate?: Date | undefined
  /** Latest selectable date. */
  maxDate?: Date | undefined
  /** Runs after the value changes (with the new `yyyy-MM-dd` value or ''). */
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * Calendar popover bound to a `yyyy-MM-dd` string field.
 * Keyboard: Enter/Space opens, arrow keys move between days, Escape closes.
 */
export function DatePickerField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label,
  placeholder = 'Pick a date',
  description,
  required,
  disabled,
  minDate,
  maxDate,
  onValueChange,
  className,
}: DatePickerFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(toInputValue(field.value))

  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  return (
    <FormField
      label={label}
      description={description}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) field.onBlur()
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              {...a11y}
              ref={field.ref}
              name={field.name}
              disabled={disabled ?? field.disabled}
              className={cn(fieldControlClassName, 'justify-between text-left')}
            >
              <span className={cn('truncate', !selected && 'text-label')}>
                {selected ? format(selected, 'dd MMM yyyy') : placeholder}
              </span>
              <CalendarDays className="size-5 shrink-0 text-chip" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? minDate}
              disabled={disabledDays}
              autoFocus
              onSelect={(date) => {
                const next = date ? toDateValue(date) : ''
                field.onChange(next)
                onValueChange?.(next)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </FormField>
  )
}
