import { format, isValid, parse, parseISO } from 'date-fns'

import type { Stamp } from '../types/manpower.types'

/** Amounts as whole numbers with thousands separators ("150,000"). */
export const formatAmount = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : ''

/** `yyyy-MM-dd` → "1 Jan 2024". */
export function formatDay(value: string): string {
  const date = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(date) ? format(date, 'd MMM yyyy') : value
}

/** `yyyy-MM` → "Jan 2024". */
export function formatMonthValue(value: string): string {
  const date = parse(value, 'yyyy-MM', new Date())
  return isValid(date) ? format(date, 'MMM yyyy') : value
}

/** ISO time → "16 Jan 2024 12:30 PM". */
export function formatStampTime(iso: string): string {
  const date = parseISO(iso)
  return isValid(date) ? format(date, 'd MMM yyyy hh:mm a') : iso
}

/** Counts as plain numbers ("5"; the design's "05" read as a code). */
export const formatCount = (value: number) => String(value)

/** A stamp from a record's time and person (`createdAt` / `createdByName` …). */
export const stampOf = (at: string, byName: string | null | undefined): Stamp => ({
  at,
  byName: byName ?? null,
})
