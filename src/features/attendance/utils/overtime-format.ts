import { format, parse } from 'date-fns'

import type {
  OvertimeApprovalBox,
  OvertimePolicyPeriod,
  OvertimeSlab,
  OvertimeStatus,
} from '../types/overtime.types'

export const OVERTIME_STATUS_LABELS: Record<OvertimeStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelling: 'Cancelling',
  cancelled: 'Cancelled',
}

export const OVERTIME_POLICY_PERIOD_LABELS: Record<OvertimePolicyPeriod, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
}

export const OVERTIME_BOX_LABELS: Record<OvertimeApprovalBox, string> = {
  requested: 'Requested',
  delegates: 'Delegates',
  consents: 'Consents',
  cancellations: 'Cancellations',
}

/** "Full Day", or the slab's leave type ("Casual Leaves"). */
export const slabEncashmentLabel = (
  slab: Pick<OvertimeSlab, 'encashmentType' | 'leaveTypeName'>,
) => (slab.encashmentType === 'full_day' ? 'Full Day' : (slab.leaveTypeName ?? 'Leave'))

const atDay = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const atClock = (time: string) => parse(time, 'HH:mm', new Date())

/** `18:00:00` / `18:00` → `18:00`. */
export const hm = (time: unknown) => (typeof time === 'string' ? time.slice(0, 5) : '')

/** "18:00" → "6:00pm", as the lists write times. */
export const clockLabel = (time: string) => (time ? format(atClock(time), 'h:mmaaa') : '—')

/** "2024-07-19" → "Jul 19, 2024". */
export const dayLabel = (date: string) => (date ? format(atDay(date), 'MMM d, yyyy') : '—')

/** ISO stamp → "August 26, 2024", as the policy list writes Created. */
export const createdLabel = (iso: string) => format(new Date(iso), 'MMMM d, yyyy')

/** ISO stamp → "Aug 26, 2024, 4:05pm", for steps. */
export const stepStampLabel = (iso: string) => format(new Date(iso), 'MMM d, yyyy, h:mmaaa')

/** "6:00pm, Jul 19, 2024": the Date (From) / Date (To) cells. */
export const stampLabel = (date: string, time: string) => `${clockLabel(time)}, ${dayLabel(date)}`

/** Sr.# as drawn: 001, 002 … */
export const serialLabel = (page: number, pageSize: number, index: number) =>
  String((page - 1) * pageSize + index + 1).padStart(3, '0')

/** 180 → "3h 00m". */
export const durationLabel = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`

/** Minutes from a start to an end clock on one day; negative when the end is not after. */
export function spanMinutes(startTime: string, endTime: string): number {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number)
  const [eh = 0, em = 0] = endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/** "1.5" → 90; NaN when not a number. */
export const hoursToMinutes = (hours: string) => Math.round(Number(hours) * 60)

/** 90 → "1.5", for the forms' hours. */
export const minutesToHours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100)

/** An API field error key without its `details.` prefix (`details.overtimeDate` → `overtimeDate`). */
export const apiField = (field: string) => field.replace(/^details\./, '')
