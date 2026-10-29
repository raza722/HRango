import { format, isValid, parse, parseISO } from 'date-fns'

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** 1,284. */
export const formatCount = (value: number) => whole.format(value)

/** 1.3K: axis ticks. */
export const formatCompact = (value: number) => compactNumber.format(value)

/** 41.2%. */
export const formatPercent = (value: number) => `${oneDecimal.format(value)}%`

/** The share of `part` in `whole` as a percentage (0 when there is no whole). */
export const shareOf = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0)

/** "1 employee", "3 employees"; `pluralForm` for irregular nouns ("person" / "people"). */
export function plural(count: number, noun: string, pluralForm = `${noun}s`): string {
  return `${formatCount(count)} ${count === 1 ? noun : pluralForm}`
}

/** Days as the API sends them (a decimal for half days): "1 day", "2.5 days". */
export function formatDays(value: number | string | null): string {
  const days = typeof value === 'string' ? Number(value) : (value ?? 0)
  const shown = Number.isFinite(days) ? Math.round(days * 100) / 100 : 0
  return `${String(shown)} ${shown === 1 ? 'day' : 'days'}`
}

function toDate(value: string): Date | null {
  const date =
    value.length === 7
      ? parse(value, 'yyyy-MM', new Date())
      : value.length === 10
        ? parse(value, 'yyyy-MM-dd', new Date())
        : parseISO(value)
  return isValid(date) ? date : null
}

/** `yyyy-MM` or a date → "October 2026". */
export function formatMonthYear(value: string): string {
  const date = toDate(value)
  return date ? format(date, 'MMMM yyyy') : value
}

/** `yyyy-MM` or a date → "Sep". */
export function formatShortMonth(value: string): string {
  const date = toDate(value.length > 7 ? value.slice(0, 10) : value)
  return date ? format(date, 'MMM') : value
}

/** "29 Oct 2026". */
export function formatDay(value: string | null): string {
  if (!value) return '—'
  const date = toDate(value.slice(0, 10))
  return date ? format(date, 'd MMM yyyy') : value
}

/** "29 Oct" – "31 Oct 2026", or one day. */
export function formatSpan(from: string | null, to: string | null): string {
  if (!from) return '—'
  if (!to || to === from) return formatDay(from)
  const start = toDate(from)
  const end = toDate(to)
  if (!start || !end) return `${from} – ${to}`
  const sameYear = start.getFullYear() === end.getFullYear()
  return `${format(start, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
}

/** A local date-time from the API (`2026-10-29T09:05:00`) → "9:05 AM"; "—" without one. */
export function formatClock(value: string | null): string {
  if (!value) return '—'
  const date = parseISO(value)
  return isValid(date) ? format(date, 'h:mm a') : value
}

/** Signed change for a delta line: "+2", "−1", "0". */
export function formatChange(value: number): string {
  if (value > 0) return `+${formatCount(value)}`
  if (value < 0) return `−${formatCount(Math.abs(value))}`
  return '0'
}
