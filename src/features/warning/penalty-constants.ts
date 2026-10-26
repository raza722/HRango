import type { SelectOption } from '@/components/form'

import type { Deduction, PenaltyPeriod, PenaltyType } from './types/warning-penalty.types'

export const PENALTY_FORM_ID = 'warning-penalty-form'

/** Upper bound on "+ Add Penalty" blocks per policy (the API takes 50). */
export const MAX_PENALTY_RULES = 50

export const PENALTY_TYPE_LABELS: Record<PenaltyType, string> = {
  half_day: 'Half Day',
  full_day: 'Full Day',
  percentage: 'Percentage',
}

export const PENALTY_TYPE_OPTIONS: readonly SelectOption<PenaltyType>[] = [
  { value: 'half_day', label: 'Half Day' },
  { value: 'full_day', label: 'Full Day' },
  { value: 'percentage', label: 'Percentage' },
]

export const DEDUCTION_LABELS: Record<Deduction, string> = {
  payroll: 'Payroll',
  leave: 'Leave',
  both: 'Both',
}

export const DEDUCTION_OPTIONS: readonly SelectOption<Deduction>[] = [
  { value: 'payroll', label: 'Payroll' },
  { value: 'leave', label: 'Leave' },
  { value: 'both', label: 'Both' },
]

/** "Count" dropdown: the 1st … 10th warning in the period. */
export const COUNT_OPTIONS: readonly SelectOption[] = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

export const PENALTY_PERIOD_LABELS: Record<PenaltyPeriod, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

/** The penalty card's Time Span dropdown uses the short labels from the design. */
export const PENALTY_TIME_SPAN_OPTIONS: readonly SelectOption<PenaltyPeriod>[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

/** "1st", "2nd", "3rd", "11th" … */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** "Half Day", "25% of a day". */
export function penaltyLabel(rule: {
  penaltyType: PenaltyType
  percentage: number | null
}): string {
  if (rule.penaltyType === 'percentage') return `${rule.percentage ?? 0}% of a day`
  return PENALTY_TYPE_LABELS[rule.penaltyType]
}
