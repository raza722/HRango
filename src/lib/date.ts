import { format, isValid, parse, parseISO } from 'date-fns'

/** Wire format of date-only values: ISO calendar date. */
export const DATE_VALUE_FORMAT = 'yyyy-MM-dd'

/** Parses a `yyyy-MM-dd` value; returns undefined for empty or invalid input. */
export function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined
  const date = parse(value, DATE_VALUE_FORMAT, new Date())
  return isValid(date) ? date : undefined
}

/** Formats a Date as `yyyy-MM-dd`. */
export function toDateValue(date: Date): string {
  return format(date, DATE_VALUE_FORMAT)
}

/** "2026-04-01" -> "01 Apr 2026"; returns the input unchanged if it is not a date. */
export function formatDisplayDate(value: string): string {
  const date = parseDateValue(value)
  return date ? format(date, 'dd MMM yyyy') : value
}

/** ISO timestamp -> "20 Oct 2026, 10:45". */
export function formatDateTime(iso: string): string {
  const date = parseISO(iso)
  return isValid(date) ? format(date, 'dd MMM yyyy, HH:mm') : iso
}

/** "13:05" -> "1:05 PM". */
export function formatTimeValue(value: string): string {
  const date = parse(value, 'HH:mm', new Date())
  return isValid(date) ? format(date, 'h:mm a') : value
}
