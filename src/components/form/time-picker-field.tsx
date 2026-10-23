import type { ReactNode } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { Clock } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { FormField } from './form-field'
import { toInputValue } from './utils'

export interface TimePickerFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  description?: ReactNode
  required?: boolean
  disabled?: boolean
  /** Keep the label for screen readers only (e.g. inside a table row). */
  hideLabel?: boolean
  /** Minute step for the native picker, in seconds (default 60). */
  step?: number
  className?: string
}

/**
 * Native `<input type="time">` (24h `HH:mm` value) with the clock icon from the design.
 * The browser's own picker indicator is stretched invisibly over the icon so a
 * click on the icon still opens the native picker.
 */
export function TimePickerField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  hideLabel,
  step = 60,
  className,
}: TimePickerFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })

  return (
    <FormField
      label={label}
      description={description}
      required={required}
      hideLabel={hideLabel}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <div className="relative">
          <Input
            {...a11y}
            type="time"
            step={step}
            ref={field.ref}
            name={field.name}
            value={toInputValue(field.value)}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled ?? field.disabled}
            className={cn(
              'pr-11 [color-scheme:light] dark:[color-scheme:dark]',
              '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-11 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
            )}
          />
          <Clock
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 text-chip"
          />
        </div>
      )}
    </FormField>
  )
}
