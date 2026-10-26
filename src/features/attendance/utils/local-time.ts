import { addMinutes, differenceInMinutes, format, isValid, parse } from 'date-fns'

import type { LocalDateTime } from '../types/attendance.types'

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm"

/** `2024-08-05` + `10:07` → `2024-08-05T10:07`. */
export function toLocal(date: string, time: string): LocalDateTime {
  return `${date}T${time}`
}

export function parseLocal(value: LocalDateTime): Date {
  return parse(value, LOCAL_FORMAT, new Date())
}

export function isLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && isValid(parseLocal(value))
}

export function formatLocal(date: Date): LocalDateTime {
  return format(date, LOCAL_FORMAT)
}

/** The date and time parts of a local date-time. */
export function splitLocal(value: LocalDateTime): { date: string; time: string } {
  return { date: value.slice(0, 10), time: value.slice(11, 16) }
}

/** Minutes from `from` to `to` (negative when `to` is earlier). */
export function minutesBetween(from: LocalDateTime, to: LocalDateTime): number {
  return differenceInMinutes(parseLocal(to), parseLocal(from))
}

export function shiftLocal(value: LocalDateTime, minutes: number): LocalDateTime {
  return formatLocal(addMinutes(parseLocal(value), minutes))
}

/** `2024-08-05T10:07` → "10:07 AM". */
export function formatClockTime(value: LocalDateTime): string {
  return format(parseLocal(value), 'hh:mm a')
}

/** `2024-08-05T10:07` → "August 5, 2024 10:07 AM" (Attendance Log). */
export function formatPunchTime(value: LocalDateTime): string {
  return format(parseLocal(value), 'MMMM d, yyyy hh:mm a')
}

/** `10:00` (or `2026-10-20T10:00`) → "Expected 10 AM", `09:30` → "Expected 9:30 AM". */
export function formatExpected(time: string): string {
  const date = parse(time.includes('T') ? time.slice(11, 16) : time, 'HH:mm', new Date())
  return `Expected ${format(date, date.getMinutes() === 0 ? 'h a' : 'h:mm a')}`
}

/** `2024-08-01` → "01-Aug-2024", as in the time sheet. */
export function formatSheetDate(date: string): string {
  return format(parse(date, 'yyyy-MM-dd', new Date()), 'dd-MMM-yyyy')
}

/** `2024-08-01` → "Thursday". */
export function weekdayName(date: string): string {
  return format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE')
}

/** `2024-01-01` → "1, January 2024", as on the person card. */
export function formatLongDate(date: string): string {
  return format(parse(date, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy')
}

/** Minutes → "7h 30m", "45m", "0m". */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const total = Math.abs(Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${sign}${rest}m`
  return rest === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${String(rest).padStart(2, '0')}m`
}
