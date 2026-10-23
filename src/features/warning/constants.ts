import type { SelectOption } from '@/components/form'

import {
  type ClockEvent,
  POLICY_NAMES,
  type PolicyName,
  type TimeSpan,
  type Weekday,
} from './types/warning-policy.types'

export const POLICY_FORM_ID = 'warning-policy-form'

/** Upper bound on period blocks ("Add Year" etc.) per policy. */
export const MAX_PERIODS = 12

export const POLICY_NAME_LABELS: Record<PolicyName, string> = {
  'grace-minutes': 'Grace Minutes',
  'late-arrival': 'Late Arrival',
  'early-departure': 'Early Departure',
  overtime: 'Over Time',
  'half-day-leave': 'Half Day Leave',
}

export const POLICY_NAME_OPTIONS: readonly SelectOption<PolicyName>[] = POLICY_NAMES.map(
  (value) => ({ value, label: POLICY_NAME_LABELS[value] }),
)

export const TIME_SPAN_OPTIONS: readonly SelectOption<TimeSpan>[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

/** Short labels used in the Warning Policy table, as in the design ("Month", "Week", "Year"). */
export const TIME_SPAN_TABLE_LABELS: Record<TimeSpan, string> = {
  weekly: 'Week',
  monthly: 'Month',
  yearly: 'Year',
}

export const CLOCK_EVENT_OPTIONS: readonly SelectOption<ClockEvent>[] = [
  { value: 'clock-in', label: 'Clock In' },
  { value: 'clock-out', label: 'Clock Out' },
]

export const CLOCK_EVENT_LABELS: Record<ClockEvent, string> = {
  'clock-in': 'Clock In',
  'clock-out': 'Clock Out',
}

interface TimeSpanCopy {
  /** Card title, e.g. "Yearly". */
  title: string
  /** Button text, e.g. "Add Year". */
  addLabel: string
  /** Heading for the 2nd+ block, e.g. "Year 2". */
  periodNoun: string
  startLabel: string
  endLabel: string
  clockInLabel: string
  clockOutLabel: string
}

/** Labels for the time-span card; the design changes them per span. */
export const TIME_SPAN_COPY: Record<TimeSpan, TimeSpanCopy> = {
  weekly: {
    title: 'Weekly',
    addLabel: 'Add Week',
    periodNoun: 'Week',
    startLabel: 'Week Start Day',
    endLabel: 'Week End Day',
    clockInLabel: 'Clock Start',
    clockOutLabel: 'Clock End',
  },
  monthly: {
    title: 'Monthly',
    addLabel: 'Add Month',
    periodNoun: 'Month',
    startLabel: 'Month Start Day',
    endLabel: 'Month End Day',
    clockInLabel: 'Clock In',
    clockOutLabel: 'Clock Out',
  },
  yearly: {
    title: 'Yearly',
    addLabel: 'Add Year',
    periodNoun: 'Year',
    startLabel: 'Year Start Day',
    endLabel: 'Year End Day',
    clockInLabel: 'Clock In',
    clockOutLabel: 'Clock Out',
  },
}

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

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
