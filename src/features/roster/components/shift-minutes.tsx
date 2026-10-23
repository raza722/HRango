import { Moon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { formatMinutes, isOvernight, shiftMinutes } from '../utils/shift-time'

interface ShiftMinutesProps {
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
