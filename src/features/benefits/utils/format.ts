import { format } from 'date-fns'

import { parseDateValue } from '@/lib/date'

/** "2024-01-01" → "1 Jan 2024" (Duration, the date boxes). */
export function formatDay(value: string): string {
  const date = parseDateValue(value)
  return date ? format(date, 'd MMM yyyy') : value
}

/** "2025-03-21" → "21 March 2025" (Plans: End Date). */
export function formatLongDay(value: string): string {
  const date = parseDateValue(value)
  return date ? format(date, 'd MMMM yyyy') : value
}

/** "1 Jan 2024 - 1 Jan 2025". */
export function formatDuration(start: string, end: string): string {
  return `${formatDay(start)} - ${formatDay(end)}`
}

/** 248000 → "242 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
}

/** "1 employee", "110 employees". */
export function employeesCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'employee' : 'employees'}`
}
