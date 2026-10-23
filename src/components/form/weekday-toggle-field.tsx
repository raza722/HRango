import { useId } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { ToggleGroup } from 'radix-ui'

import { cn } from '@/lib/utils'

export interface WeekdayOption {
  value: string
  /** Text inside the circle, e.g. "Mon". */
  short: string
  /** Accessible name, e.g. "Monday". */
  label: string
}

export interface WeekdayToggleFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string[]>,
> {
  control: Control<TFieldValues>
  name: TName
  options: readonly WeekdayOption[]
  /** Accessible name of the group. */
  label: string
}

/**
 * Round Mon … Sun toggles (multi-select) bound to a `string[]` form field.
 * Phones get seven equal columns that shrink with the card; wider cards get
 * fixed 44px circles, as drawn.
 */
export function WeekdayToggleField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string[]>,
>({ control, name, options, label }: WeekdayToggleFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })
  const errorId = useId()
  const raw: unknown = field.value
  const value: string[] = Array.isArray(raw)
    ? raw.filter((item: unknown): item is string => typeof item === 'string')
    : []

  return (
    <div className="flex flex-col items-center gap-2">
      <ToggleGroup.Root
        type="multiple"
        aria-label={label}
        aria-describedby={fieldState.error ? errorId : undefined}
        value={value}
        onValueChange={(next) => {
          field.onChange(next.filter((day) => options.some((option) => option.value === day)))
        }}
        className="grid w-full max-w-sm grid-cols-7 gap-1.5 @md:flex @md:w-auto @md:max-w-none @md:justify-center @md:gap-3"
      >
        {options.map((day) => (
          <ToggleGroup.Item
            key={day.value}
            value={day.value}
            aria-label={day.label}
            className={cn(
              'flex aspect-square w-full items-center justify-center rounded-full border border-chip text-xs text-chip-foreground transition-colors outline-none @md:size-11 @md:text-sm',
              'hover:text-chip-active-foreground focus-visible:ring-2 focus-visible:ring-ring/40',
              'data-[state=on]:bg-chip data-[state=on]:text-chip-active-foreground',
            )}
          >
            {day.short}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {fieldState.error && (
        <p id={errorId} className="text-xs text-destructive">
          {fieldState.error.message}
        </p>
      )}
    </div>
  )
}
