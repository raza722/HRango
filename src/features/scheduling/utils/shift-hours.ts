import type { ScheduleBreak, ScheduleEntry } from '../types/scheduling.types'

const MINUTES_PER_DAY = 24 * 60

/** `HH:mm` or `HH:mm:ss` → minutes after midnight. */
function toMinutes(time: string | null): number | null {
  const match = time ? /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time) : null
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** `"2026-11-02T09:00:00"` (an API date-time) → `"09:00"`; `null` when it has no time. */
export function clockOf(dateTime: string | null | undefined): string | null {
  const match = dateTime ? /T(\d{2}:\d{2})/.exec(dateTime) : null
  return match?.[1] ?? null
}

/** `"09:00:00"` (an API time) → `"09:00"`. */
export const hhmm = (time: string | null | undefined): string | null =>
  time ? time.slice(0, 5) : null

/** Clock in to clock out; a clock out before the clock in ends the next day. */
export function spanMinutes(clockIn: string | null, clockOut: string | null): number {
  const start = toMinutes(clockIn)
  const end = toMinutes(clockOut)
  if (start === null || end === null) return 0
  return (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

export function breakMinutes(item: ScheduleBreak): number {
  return spanMinutes(item.startTime, item.endTime)
}

/**
 * Planned working minutes of one mock-store entry (the API sends `plannedMinutes`): a flexible slot counts its workable
 * hours; otherwise the shift length minus breaks that are not inclusive.
 */
export function plannedMinutes(entry: ScheduleEntry): number {
  if (entry.kind !== 'shift') return 0
  if (entry.slot.mode === 'flexible' && entry.slot.workableMinutes !== null) {
    return entry.slot.workableMinutes
  }
  const unpaid = entry.breaks
    .filter((item) => !item.inclusive && entry.date >= item.startDate && entry.date <= item.endDate)
    .reduce((sum, item) => sum + breakMinutes(item), 0)
  return Math.max(0, spanMinutes(entry.clockIn, entry.clockOut) - unpaid)
}

/** 0 → "0m", 420 → "7h", 5760 → "96h", 450 → "7h 30m", as on the board. */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** "10:00" (or "10:00:00") → "10:00 AM", as the cells print times. */
export function formatClock(time: string | null): string {
  const minutes = toMinutes(time)
  if (minutes === null) return '--:--'
  const hours = Math.floor(minutes / 60)
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${String(hour12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

/** "8 hrs, 30 min" style for the overtime and workable-hours fields. */
export function formatHoursText(minutes: number | null): string {
  if (minutes === null) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours} hrs`
  return `${hours} hrs, ${rest} min`
}
