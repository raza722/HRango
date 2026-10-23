import { format, parse, parseISO } from 'date-fns'

import { formatTimeValue } from '@/lib/date'

/** `2024-08-23` → "Fri, 23 Aug 2024", as in the lists. */
export const listDate = (date: string) =>
  format(parse(date, 'yyyy-MM-dd', new Date()), 'EEE, d MMM yyyy')

/** `2024-08-23` → "Fri, 23 August 2024". */
export const longDate = (date: string) =>
  format(parse(date, 'yyyy-MM-dd', new Date()), 'EEE, d MMMM yyyy')

/** ISO timestamp → "5:39 PM, 25 Aug 2024". */
export const stamp = (iso: string) => format(parseISO(iso), 'h:mm a, d MMM yyyy')

/** `17:00` → "05:00 PM"; "—" when empty. */
export const clock = (time: string | null) => {
  if (!time) return '—'
  const label = formatTimeValue(time)
  return label.length === 7 ? `0${label}` : label
}
