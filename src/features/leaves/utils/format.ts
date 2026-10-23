import { format, parse, parseISO } from 'date-fns'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "Aug 30, 2024", or "Aug 30 – Sep 2, 2024" for several days. */
export function leaveDates(from: string, to: string): string {
  if (from === to) return format(day(from), 'MMM d, yyyy')
  const first = day(from)
  const last = day(to)
  return first.getFullYear() === last.getFullYear()
    ? `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`
    : `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`
}

/** "Aug 29, 2024". */
export const shortStamp = (iso: string) => format(parseISO(iso), 'MMM d, yyyy')

/** "Aug 29, 2024, 10:15 AM". */
export const longStamp = (iso: string) => format(parseISO(iso), 'MMM d, yyyy, hh:mm a')

/** "01", "12", "0.5": whole days with two digits, as the frames draw them. */
export function leaveDays(count: number): string {
  const rounded = Math.round(count * 100) / 100
  return Number.isInteger(rounded) ? String(rounded).padStart(2, '0') : String(rounded)
}

/** "01".."10": the row's number on its page. */
export const serial = (page: number, pageSize: number, index: number) =>
  String((page - 1) * pageSize + index + 1).padStart(2, '0')

/** 8, 14.5. */
export const balanceDays = (value: number) => String(Math.round(value * 100) / 100)
