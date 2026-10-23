export const POLICY_NAMES = [
  'grace-minutes',
  'late-arrival',
  'early-departure',
  'overtime',
  'half-day-leave',
] as const
export type PolicyName = (typeof POLICY_NAMES)[number]

export const TIME_SPANS = ['weekly', 'monthly', 'yearly'] as const
export type TimeSpan = (typeof TIME_SPANS)[number]

export const CLOCK_EVENTS = ['clock-in', 'clock-out'] as const
export type ClockEvent = (typeof CLOCK_EVENTS)[number]

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** One rule block inside a policy (one "Year", "Month" or "Week" card section). */
export interface PolicyPeriod {
  /** Monthly/yearly: ISO date `yyyy-MM-dd`. Weekly: the weekday the cycle starts on. */
  startDay: string
  /** Monthly/yearly: ISO date `yyyy-MM-dd`. Weekly: the weekday the cycle ends on. */
  endDay: string
  /** Month picked in the month selector (0 = January); `null` for weekly periods. */
  month: number | null
  /** Day picked in the day selector, 1-based. */
  day: number
  /** Weekly only: days of the week the rule applies to. */
  weekdays: Weekday[]
  /** Grace minutes allowed across the whole period. */
  totalGraceMinutes: number
  /** Expected clock-in time, `HH:mm`. */
  clockIn: string
  /** Expected clock-out time, `HH:mm`. */
  clockOut: string
  /** Grace minutes allowed per occurrence. */
  minutes: number
}

/** A warning policy as stored by the API. */
export interface WarningPolicy {
  id: string
  policyName: PolicyName
  title: string
  timeSpan: TimeSpan
  /** Which clock event the grace applies to. */
  clockEvent: ClockEvent
  periods: PolicyPeriod[]
  createdAt: string
  updatedAt: string
}

/** Body of `POST /warning-policies` and `PUT /warning-policies/:id`. */
export type WarningPolicyInput = Omit<WarningPolicy, 'id' | 'createdAt' | 'updatedAt'>
