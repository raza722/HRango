import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

/** A `yyyy-MM-dd` or ISO value as a Date, or null. */
export function dateOf(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

/** "14 Oct 2026"; '—' for nothing. */
export function formatDay(value: string | null | undefined): string {
  const date = dateOf(value)
  return date ? format(date, 'd MMM yyyy') : '—'
}

/** "14 Oct 2026, 10:30 AM" (local time). */
export function formatStamp(value: string | null | undefined): string {
  const date = dateOf(value)
  return date ? format(date, 'd MMM yyyy, h:mm a') : '—'
}

/** "10:30 AM". */
export function formatTime(value: string | null | undefined): string {
  const date = dateOf(value)
  return date ? format(date, 'h:mm a') : '—'
}

/** "3 hours ago" / "in 2 days". */
export function formatRelative(value: string | null | undefined): string {
  const date = dateOf(value)
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : '—'
}

/** Whole rupees with separators: "120,000". */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(value)
}

/** "Rs 90,000 – 130,000", one end, or '—'. */
export function formatSalaryRange(from: number | null, to: number | null): string {
  if (from === null && to === null) return '—'
  if (from !== null && to !== null) return `Rs ${formatAmount(from)} – ${formatAmount(to)}`
  return from !== null ? `From Rs ${formatAmount(from)}` : `Up to Rs ${formatAmount(to)}`
}

/** "2–5 years", "3+ years", '—'. */
export function formatExperience(from: number | null, to: number | null): string {
  if (from === null && to === null) return '—'
  if (from !== null && to !== null) return from === to ? `${from} years` : `${from}–${to} years`
  return from !== null ? `${from}+ years` : `Up to ${String(to)} years`
}

/** A rating out of five: "4.5 / 5", '—'. */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${String(Math.round(value * 10) / 10)} / 5`
}

/** Labels that look up a value, falling back to the value itself ('—' for nothing). */
export function labelOf<T extends string>(labels: Record<T, string>, value: string | null): string {
  if (!value) return '—'
  return (labels as Partial<Record<string, string>>)[value] ?? value
}

/** Trimmed text, or null for an empty box. */
export const blank = (text: string | null | undefined): string | null => {
  const trimmed = (text ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** A number box's value: null when empty; commas allowed. */
export function numberOrNull(text: string): number | null {
  const clean = text.replace(/,/g, '').trim()
  if (clean === '') return null
  const value = Number(clean)
  return Number.isFinite(value) ? value : null
}

/** A number for a text box ('' for nothing). */
export const numberText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)
