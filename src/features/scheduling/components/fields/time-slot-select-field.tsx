import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { SelectField } from '@/components/form'
import { timeSlotSelectOptions } from '@/features/roster'

import { useTimeSlotOptions } from '../../hooks/use-scheduling'

interface TimeSlotSelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  required?: boolean
  placeholder?: string
  /** Adds a first item that clears the field (Multi Edit: "keep each shift's slot"). */
  clearable?: string
  onValueChange?: (value: string) => void
}

/** "Time Slot": a slot from Scheduling settings (`/scheduling/options/time-slots`). */
export function TimeSlotSelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label = 'Time Slot',
  required,
  placeholder = 'Select Time Slot',
  clearable,
  onValueChange,
}: TimeSlotSelectFieldProps<TFieldValues, TName>) {
  const slots = useTimeSlotOptions()
  const options = timeSlotSelectOptions(slots.data ?? [])
  return (
    <SelectField
      control={control}
      name={name}
      label={label}
      required={required}
      placeholder={slots.isPending ? 'Loading time slots…' : placeholder}
      options={options}
      {...(clearable ? { clearable } : {})}
      {...(onValueChange ? { onValueChange } : {})}
      description={
        !slots.isPending && options.length === 0
          ? 'No time slots yet. They are set up in Scheduling settings.'
          : undefined
      }
    />
  )
}
