import type { SelectOption } from '@/components/form'

import type { TimeSlotOption } from '../types/roster.types'

/** "Morning (09:00–17:00)" options for a time slot select. */
export function timeSlotSelectOptions(slots: readonly TimeSlotOption[]): SelectOption[] {
  return slots.map((slot) => ({
    value: slot.id,
    label:
      slot.startTime && slot.endTime
        ? `${slot.name} (${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)})`
        : slot.name,
  }))
}
