import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

/** "3 users", "1 user". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

const parse = (value: string | null | undefined) => {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

/** "28 Oct 2026, 14:05". */
export function formatStamp(value: string | null | undefined): string {
  const date = parse(value)
  return date ? format(date, 'd MMM yyyy, HH:mm') : '—'
}

/** "28 Oct 2026". */
export function formatDay(value: string | null | undefined): string {
  const date = parse(value)
  return date ? format(date, 'd MMM yyyy') : '—'
}

/** "5 minutes ago" (for the times next to a stamp). */
export function formatAgo(value: string | null | undefined): string | null {
  const date = parse(value)
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : null
}

/** "Sara Khan’s". */
export const possessive = (name: string) => (name.endsWith('s') ? `${name}’` : `${name}’s`)
