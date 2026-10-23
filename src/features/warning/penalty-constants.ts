import type { SelectOption } from '@/components/form'

import {
  BADGE_COLORS,
  type BadgeColor,
  type Deduction,
  type PenaltyType,
  type ScaleType,
} from './types/warning-penalty.types'
import type { TimeSpan } from './types/warning-policy.types'

export const PENALTY_FORM_ID = 'warning-penalty-form'

/** Upper bound on "+ Add Penalty" blocks per penalty. */
export const MAX_PENALTY_RULES = 10

export const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  number: 'Number',
  percentage: 'Percentage',
}

export const SCALE_TYPE_OPTIONS: readonly SelectOption<ScaleType>[] = [
  { value: 'number', label: 'Number' },
  { value: 'percentage', label: 'Percentage' },
]

export const PENALTY_TYPE_LABELS: Record<PenaltyType, string> = {
  'half-day': 'Half Day',
  'full-day': 'Full Day',
}

export const PENALTY_TYPE_OPTIONS: readonly SelectOption<PenaltyType>[] = [
  { value: 'half-day', label: 'Half Day' },
  { value: 'full-day', label: 'Full Day' },
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

/** Swatch colours, as drawn in the Badge Color dropdown. */
export const BADGE_COLOR_VALUES: Record<BadgeColor, string> = {
  red: '#E5383B',
  green: '#2CBD4D',
  blue: '#0A7CFF',
}

export const BADGE_COLOR_LABELS: Record<BadgeColor, string> = {
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
}

export const BADGE_COLOR_OPTIONS: readonly SelectOption<BadgeColor>[] = BADGE_COLORS.map(
  (value) => ({ value, label: BADGE_COLOR_LABELS[value], swatch: BADGE_COLOR_VALUES[value] }),
)

/** "Count" dropdown: 1–10 warnings. */
export const COUNT_OPTIONS: readonly SelectOption[] = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

/** The penalty card's Time Span dropdown uses the short labels from the design. */
export const PENALTY_TIME_SPAN_OPTIONS: readonly SelectOption<TimeSpan>[] = [
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
]
