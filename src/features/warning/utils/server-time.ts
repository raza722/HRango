import { format, isValid, parseISO } from 'date-fns'

/**
 * `createdAt`, `updatedAt` and `performedAt` come from the API as UTC without a zone
 * (`2026-10-26T05:22:44`). Adds the `Z` so they read as UTC and show in local time.
 */
export function toUtcIso(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
}

/** Parses a server time stamp (UTC, zone optional). */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = parseISO(toUtcIso(value))
  return isValid(date) ? date : null
}

/** "26 Oct 2026, 10:22" in local time, or "—". */
export function formatServerTime(value: string | null | undefined): string {
  const date = parseServerTime(value)
  return date ? format(date, 'dd MMM yyyy, HH:mm') : '—'
}
