import { differenceInCalendarMonths, format, isValid, parseISO } from 'date-fns'

import { parseDateValue } from '@/lib/date'

/** "16 Oct 2021" from `yyyy-MM-dd` (or an ISO stamp); '' for none. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return ''
  const date = value.length > 10 ? parseISO(value) : parseDateValue(value)
  return date && isValid(date) ? format(date, 'dd MMM yyyy') : value
}

/** "12-10-2022": the Resume card's date. */
export function formatDashDay(value: string | null | undefined): string {
  if (!value) return ''
  const date = value.length > 10 ? parseISO(value) : parseDateValue(value)
  return date && isValid(date) ? format(date, 'dd-MM-yyyy') : value
}

/** "Dec 2024": a payslip month. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return ''
  const date = parseDateValue(value.slice(0, 10))
  return date ? format(date, 'MMM yyyy') : value
}

/** "2018-2022", "2021-Present", "2016" from two dates (one year when both fall in it). */
export function yearRange(from: string | null, to: string | null, ongoing = false): string {
  const start = from?.slice(0, 4) ?? ''
  const end = ongoing ? 'Present' : (to?.slice(0, 4) ?? '')
  if (start && end) return start === end ? start : `${start}-${end}`
  return start || end
}

/** "21 Jan 2024 - 21 Feb 2024" (or "… - Open-ended"). */
export function dayRange(from: string | null, to: string | null): string {
  const start = formatDay(from)
  const end = to ? formatDay(to) : 'Open-ended'
  return start ? `${start} - ${end}` : end
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`

/**
 * Tenure as the Personal list draws it: "2 Years & 3 Months". From the API's `tenureMonths`, or
 * worked out from the joining date (to today, or to the end date of someone who left).
 */
export function tenureText(
  tenureMonths: number | null,
  joiningDate: string | null,
  endDate: string | null = null,
  today: Date = new Date(),
): string {
  let months = tenureMonths
  if (months === null && joiningDate) {
    const start = parseDateValue(joiningDate)
    const end = (endDate ? parseDateValue(endDate) : undefined) ?? today
    months = start ? Math.max(0, differenceInCalendarMonths(end, start)) : null
  }
  if (months === null) return ''
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return plural(rest, 'Month')
  if (rest === 0) return plural(years, 'Year')
  return `${plural(years, 'Year')} & ${plural(rest, 'Month')}`
}

/** "150,000"; '' for none. */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number.toLocaleString('en-US') : String(value)
}

/** "Hamza Ashraf" → first "Hamza", last "Ashraf"; the last word is the last name. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return { firstName: words[0] ?? '', lastName: '' }
  return { firstName: words.slice(0, -1).join(' '), lastName: words.at(-1) ?? '' }
}

/** Sr. # as the design writes it: "01", "02" … */
export const serialOf = (page: number, pageSize: number, index: number) =>
  String((page - 1) * pageSize + index + 1).padStart(2, '0')

/** Trimmed text, or null for blank (the API's optional strings). */
export const textOrNull = (value: string | null | undefined) => {
  const text = value?.trim() ?? ''
  return text === '' ? null : text
}
