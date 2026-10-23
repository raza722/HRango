import type { ReactNode } from 'react'
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form'

import { FormField } from '@/components/form'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface TwoWaySwitchProps<V extends string> {
  /** [left, right]: the switch is on for the right one. */
  options: readonly [{ value: V; label: string }, { value: V; label: string }]
  value: V
  onChange: (value: V) => void
  disabled?: boolean
  label: string
  id?: string
  className?: string
  /** Colour of the side not chosen (default #707070; the Payroll Create form draws #585858). */
  offClassName?: string
}

/** Figma: both names Inter Regular 16; the chosen one #17263A, the other #707070. */
const onText = 'text-sidebar dark:text-heading'
const offText = 'text-grey'

/** "Actual ◯ Fixed", "Flat ◯ Percentage", "No ◯ Yes": a switch between two named choices. */
export function TwoWaySwitch<V extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
  id,
  className,
  offClassName = offText,
}: TwoWaySwitchProps<V>) {
  const [left, right] = options
  const on = value === right.value
  return (
    <span
      className={cn('flex min-h-10 items-center gap-3 font-inter text-sm sm:text-base', className)}
    >
      <span className={on ? offClassName : onText}>{left.label}</span>
      <Switch
        id={id}
        checked={on}
        disabled={disabled}
        aria-label={`${label}: ${on ? right.label : left.label}`}
        onCheckedChange={(checked) => {
          onChange(checked ? right.value : left.value)
        }}
        className="data-[state=checked]:bg-[#17263A] dark:data-[state=checked]:bg-primary"
      />
      <span className={on ? onText : offClassName}>{right.label}</span>
    </span>
  )
}

interface TwoWaySwitchFieldProps<T extends FieldValues, V extends string> {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  /** Accessible name for the switch (the label as text). */
  ariaLabel: string
  options: readonly [{ value: V; label: string }, { value: V; label: string }]
  disabled?: boolean
  className?: string
  offClassName?: string
  onValueChange?: (value: V) => void
}

/** `TwoWaySwitch` in a form row. */
export function TwoWaySwitchField<T extends FieldValues, V extends string>({
  control,
  name,
  label,
  ariaLabel,
  options,
  disabled,
  className,
  offClassName,
  onValueChange,
}: TwoWaySwitchFieldProps<T, V>) {
  const { field } = useController({ control, name })
  return (
    <FormField label={label} className={className}>
      {(a11y) => (
        <TwoWaySwitch
          id={a11y.id}
          label={ariaLabel}
          options={options}
          value={field.value}
          disabled={disabled}
          offClassName={offClassName}
          onChange={(next) => {
            field.onChange(next)
            onValueChange?.(next)
          }}
        />
      )}
    </FormField>
  )
}
