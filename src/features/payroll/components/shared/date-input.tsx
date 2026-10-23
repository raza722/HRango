import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'

import { fieldControlClassName, FormField } from '@/components/form'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { fieldValueText } from '../../utils/styles'

interface DateInputProps {
  id?: string
  /** `yyyy-MM-dd`, or '' for none. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date | undefined
  maxDate?: Date | undefined
  /** date-fns pattern for the shown value ("d MMMM, yyyy" → "14 August, 2024"). */
  display?: string
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** A date box with the calendar icon on the right, as in the Payroll dialogs. */
export function DateInput({
  id,
  value,
  onChange,
  placeholder = 'Choose a date',
  disabled = false,
  minDate,
  maxDate,
  display = 'd MMMM, yyyy',
  className,
  ...aria
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(value)
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span className="truncate" data-placeholder={selected ? undefined : ''}>
            {selected ? format(selected, display) : placeholder}
          </span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-heading" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate ?? minDate}
          disabled={disabledDays}
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

interface DateFieldProps<T extends FieldValues, N extends FieldPathByValue<T, string>> {
  control: Control<T>
  name: N
  label: ReactNode
  required?: boolean
  disabled?: boolean
  minDate?: Date | undefined
  maxDate?: Date | undefined
  display?: string
  className?: string
}

export function DateField<T extends FieldValues, N extends FieldPathByValue<T, string>>({
  control,
  name,
  label,
  required,
  disabled,
  minDate,
  maxDate,
  display,
  className,
}: DateFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <DateInput
          {...a11y}
          value={field.value ?? ''}
          onChange={field.onChange}
          disabled={disabled}
          minDate={minDate}
          maxDate={maxDate}
          display={display}
        />
      )}
    </FormField>
  )
}
