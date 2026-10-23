import { format, isValid, parse, parseISO } from 'date-fns'

/** Amounts as the lists draw them: whole numbers without separators ("150000"). */
export const formatAmount = (value: number) =>
  Number.isFinite(value) ? String(Math.round(value)) : ''

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

/** Total Positions as drawn: two digits ("05"). */
export const formatCount = (value: number) => String(value).padStart(2, '0')
