import { format, isValid, parseISO } from 'date-fns'

import { parseDateValue } from '@/lib/date'

/** "2026-12-15" → "15 Dec 2026"; '—' when empty. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = parseDateValue(value.slice(0, 10))
  return date ? format(date, 'dd MMM yyyy') : value
}

/** An instant → "15 Dec 2026, 10:45" in local time. */
export function formatStamp(value: string | null | undefined): string {
  if (!value) return '—'
  const date = parseISO(value)
  return isValid(date) ? format(date, 'dd MMM yyyy, HH:mm') : value
}

/** "01 Jan – 31 Dec 2026" (both years when they differ). */
export function formatPeriod(start: string, end: string): string {
  const from = parseDateValue(start)
  const to = parseDateValue(end)
  if (!from || !to) return `${start} – ${end}`
  return from.getFullYear() === to.getFullYear()
    ? `${format(from, 'dd MMM')} – ${format(to, 'dd MMM yyyy')}`
    : `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`
}

/** 1,234.5 → "1,234.5" (up to two decimals). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** A score on the rating scale, always with two decimals ("3.00", "4.55"); '—' when none. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** A value with its unit: "34 days", "92 %", "PKR 25,000,000". */
export function withUnit(value: number | null, unit: string | null): string {
  if (value === null) return '—'
  if (!unit) return formatNumber(value)
  if (unit === 'PKR' || unit === 'USD') return `${unit} ${formatNumber(value)}`
  return unit === '%' ? `${formatNumber(value)}%` : `${formatNumber(value)} ${unit}`
}

/** The row number on a page. */
export const serialOf = (page: number, pageSize: number, index: number) =>
  (page - 1) * pageSize + index + 1

/** Text input → number, or null when empty or not a number. */
export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, '')
  if (trimmed === '') return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : null
}

/** Number → text input value. */
export const toText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)
