import { useMemo } from 'react'

import { NEUTRAL_TONE, SHIFT_TONES, type ShiftTone } from '../constants'
import { useTimeSlotOptions } from './use-scheduling'

/**
 * A colour for each time slot, so every shift of one slot looks the same on the board. A
 * slot's own colour (Scheduling settings) wins; others take the drawn pastel tones in turn.
 */
export function useSlotTones() {
  const query = useTimeSlotOptions()
  const slots = useMemo(() => query.data ?? [], [query.data])

  return useMemo(() => {
    const tones = new Map<string, ShiftTone>()
    slots.forEach((slot, index) => {
      tones.set(slot.id, SHIFT_TONES[index % SHIFT_TONES.length] ?? NEUTRAL_TONE)
    })
    return {
      slots,
      toneFor: (timeSlotId: string | null): ShiftTone =>
        (timeSlotId ? tones.get(timeSlotId) : undefined) ?? NEUTRAL_TONE,
    }
  }, [slots])
}
