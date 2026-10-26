import type { SelectOption } from '@/components/form'

import {
  type ClockEvent,
  POLICY_NAMES,
  type PolicyName,
  TIME_SPANS,
  type TimeSpan,
  type Weekday,
} from './types/warning-policy.types'

export const POLICY_FORM_ID = 'warning-policy-form'

/** Upper bound on rules per policy (one per clock event). */
export const MAX_PERIODS = 2
export const MAX_RULES = MAX_PERIODS

/** "Policy Name" in the design: what the policy watches (`appliesTo`). */
export const POLICY_NAME_LABELS: Record<PolicyName, string> = {
  late_arrival: 'Late Arrival',
  early_departure: 'Early Departure',
  overtime: 'Over Time',
  half_day_leave: 'Half Day Leave',
}
export const APPLIES_TO_LABELS = POLICY_NAME_LABELS

export const POLICY_NAME_OPTIONS: readonly SelectOption<PolicyName>[] = POLICY_NAMES.map(
  (value) => ({ value, label: POLICY_NAME_LABELS[value] }),
)

/** Time Span select of the policy form. */
export const TIME_SPAN_LABELS: Record<TimeSpan, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
}

export const TIME_SPAN_OPTIONS: readonly SelectOption<TimeSpan>[] = TIME_SPANS.map((value) => ({
  value,
  label: TIME_SPAN_LABELS[value],
}))

/** Short labels used in the Warning Policy table, as in the design ("Month", "Week", "Year"). */
export const TIME_SPAN_TABLE_LABELS: Record<TimeSpan, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

export const CLOCK_EVENT_LABELS: Record<ClockEvent, string> = {
  clock_in: 'Clock In',
  clock_out: 'Clock Out',
}

export const CLOCK_EVENT_OPTIONS: readonly SelectOption<ClockEvent>[] = [
  { value: 'clock_in', label: 'Clock In' },
  { value: 'clock_out', label: 'Clock Out' },
]

export const WEEKDAY_OPTIONS: readonly { value: Weekday; short: string; label: string }[] = [
  { value: 'mon', short: 'Mon', label: 'Monday' },
  { value: 'tue', short: 'Tue', label: 'Tuesday' },
  { value: 'wed', short: 'Wed', label: 'Wednesday' },
  { value: 'thu', short: 'Thu', label: 'Thursday' },
  { value: 'fri', short: 'Fri', label: 'Friday' },
  { value: 'sat', short: 'Sat', label: 'Saturday' },
  { value: 'sun', short: 'Sun', label: 'Sunday' },
]

export const WEEKDAY_SELECT_OPTIONS: readonly SelectOption<Weekday>[] = WEEKDAY_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
)

/** "Active" / "Inactive". */
export const STATUS_LABELS = { true: 'Active', false: 'Inactive' } as const
