import { Moon } from 'lucide-react'

import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import type { TimeSlotOption } from '../types/roster.types'
import { formatMinutes, isOvernight, shiftMinutes, toHhMm } from '../utils/shift-time'

interface ShiftMinutesProps {
  /** `HH:mm` or `HH:mm:ss`. */
  clockIn: string | null
  clockOut: string | null
  isWeekend?: boolean
  /** Accessible name, e.g. "Monday defined minutes". */
  label: string
  className?: string
}

/**
 * The read-only "Defined Minutes" box: the shift length worked out from the
 * two times, with a "+1 day" mark when the shift ends after midnight.
 */
export function ShiftMinutes({
  clockIn,
  clockOut,
  isWeekend = false,
  label,
  className,
}: ShiftMinutesProps) {
  const minutes = isWeekend ? null : shiftMinutes(clockIn, clockOut)
  const overnight = !isWeekend && isOvernight(clockIn, clockOut)

  return (
    <output
      aria-label={label}
      className={cn(
        'flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-muted px-3 text-sm text-field-foreground tabular-nums sm:px-4 pointer-coarse:h-11',
        className,
      )}
    >
      <span className="truncate">
        {isWeekend ? 'Day off' : minutes === null ? '0' : formatMinutes(minutes)}
      </span>
      {overnight && (
        <span
          title="Ends the next day"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm bg-card px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          <Moon aria-hidden="true" className="size-3" />
          +1 day
        </span>
      )}
    </output>
  )
}

/** "9:00 AM – 5:00 PM" of a slot, "Day off", or a dash when none is picked. */
export function SlotTimes({
  slot,
  isDayOff,
  className,
}: {
  slot: Pick<TimeSlotOption, 'startTime' | 'endTime'> | undefined
  isDayOff: boolean
  className?: string
}) {
  const start = toHhMm(slot?.startTime)
  const end = toHhMm(slot?.endTime)
  return (
    <span className={cn('text-sm text-field-foreground tabular-nums', className)}>
      {isDayOff
        ? 'Day off'
        : start && end
          ? `${formatTimeValue(start)} – ${formatTimeValue(end)}`
          : '—'}
    </span>
  )
}
