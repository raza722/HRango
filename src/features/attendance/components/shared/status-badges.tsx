import { cn } from '@/lib/utils'

import { DAY_STATUS_META, PUNCH_STATUS_META } from '../../constants'
import type { DayStatus, PunchStatus } from '../../types/attendance.types'

/** The Figma legend icon of a day status. Decorative: the label sits beside it. */
export function StatusIcon({ status, className }: { status: DayStatus; className?: string }) {
  return (
    <img
      src={DAY_STATUS_META[status].icon}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('size-5 shrink-0 object-contain', className)}
    />
  )
}

/** Icon and label of a day status, for rows without clock statuses (Leave, Holiday…). */
export function StatusPill({ status, className }: { status: DayStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-0.5 text-xs whitespace-nowrap text-field-foreground',
        className,
      )}
    >
      <StatusIcon status={status} className="size-4" />
      {DAY_STATUS_META[status].label}
    </span>
  )
}

/** "Present" / "Late Arrival" / "Missing Punch" / "Absent" chip of the time sheet. */
export function PunchChip({ status }: { status: PunchStatus }) {
  const meta = PUNCH_STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex min-w-[4.8rem] items-center justify-center rounded-sm px-2 py-1 text-xs leading-none font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}
