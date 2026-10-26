import { format, parse, parseISO } from 'date-fns'

import type { LeaveCategory } from '../constants'
import type { LeaveApplication } from '../types/leaves.types'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "Aug 30, 2024", or "Aug 30 – Sep 2, 2024" for several days; "—" without dates. */
export function leaveDates(from: string | null, to: string | null): string {
  if (!from) return '—'
  if (!to || from === to) return format(day(from), 'MMM d, yyyy')
  const first = day(from)
  const last = day(to)
  return first.getFullYear() === last.getFullYear()
    ? `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`
    : `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`
}

/** "Aug 29, 2024". */
export const shortStamp = (iso: string | null) => (iso ? format(parseISO(iso), 'MMM d, yyyy') : '—')

/** "Aug 29, 2024, 10:15 AM". */
export const longStamp = (iso: string | null) =>
  iso ? format(parseISO(iso), 'MMM d, yyyy, hh:mm a') : '—'

/** "10:00 AM" from the API's `HH:mm` or `HH:mm:ss`. */
export function clockTime(value: string | null): string {
  if (!value) return ''
  const [hours = '0', minutes = '0'] = value.split(':')
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes))
  return format(date, 'hh:mm a')
}

/** "01", "12", "0.5": whole days with two digits, as the frames draw them. */
export function leaveDays(count: number | null): string {
  if (count === null) return '—'
  const rounded = Math.round(count * 100) / 100
  return Number.isInteger(rounded) ? String(rounded).padStart(2, '0') : String(rounded)
}

/** "01".."10": the row's number on its page. */
export const serial = (page: number, pageSize: number, index: number) =>
  String((page - 1) * pageSize + index + 1).padStart(2, '0')

/** 8, 14.5; "—" when not given. */
export const balanceDays = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : String(Math.round(value * 100) / 100)

/** Single (one day or part of one) or Multiple, from the dates. */
export const categoryOf = (application: Pick<LeaveApplication, 'fromDate' | 'toDate'>) =>
  (!application.toDate || application.fromDate === application.toDate
    ? 'single'
    : 'multiple') satisfies LeaveCategory

/** "Line Manager" from `line_manager`. */
export const words = (code: string | null) =>
  code ? code.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
