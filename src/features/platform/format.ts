import type { SelectOption } from '@/components/form'
import { formatDisplayDate } from '@/lib/date'

const PKR = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 })

export const formatMoney = (value: number) => `PKR ${PKR.format(value)}`
/** A date, or a timestamp's date. */
export const formatDate = (value: string | null) =>
  value ? formatDisplayDate(value.slice(0, 10)) : '—'
/** An empty form value, as the API wants it. */
export const blank = (value: string | undefined) =>
  value === undefined || value === '' ? null : value
/** `past_due` -> "Past due". */
export const labelOf = (value: string) => {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
export const optionsOf = (values: readonly string[]): SelectOption[] =>
  values.map((value) => ({ value, label: labelOf(value) }))
