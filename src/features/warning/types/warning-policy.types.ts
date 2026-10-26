/**
 * Warning policies as `/api/warning/policies` sends them (camelCase, string ids). A policy watches one
 * thing (`appliesTo`) over one period, with one rule per clock event and its own penalty rules.
 */

/** What a policy watches (`appliesTo`). The old name "policy name" is kept for the screens. */
export const POLICY_NAMES = [
  'late_arrival',
  'early_departure',
  'overtime',
  'half_day_leave',
] as const
export type PolicyName = (typeof POLICY_NAMES)[number]
export const APPLIES_TO = POLICY_NAMES
export type AppliesTo = PolicyName

/** The policy's period (`period`): occurrences and grace are counted per day, week, month or year. */
export const TIME_SPANS = ['day', 'week', 'month', 'year'] as const
export type TimeSpan = (typeof TIME_SPANS)[number]

export const CLOCK_EVENTS = ['clock_in', 'clock_out'] as const
export type ClockEvent = (typeof CLOCK_EVENTS)[number]

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** The clock events each kind of policy can measure (checked again by the server). */
export const CLOCK_EVENTS_FOR: Record<AppliesTo, readonly ClockEvent[]> = {
  late_arrival: ['clock_in'],
  early_departure: ['clock_out'],
  overtime: ['clock_in', 'clock_out'],
  half_day_leave: ['clock_in', 'clock_out'],
}

/** Most rules a policy of this kind may have (one per clock event; half-day leave has one). */
export function maxRulesFor(appliesTo: AppliesTo): number {
  return appliesTo === 'half_day_leave' ? 1 : CLOCK_EVENTS_FOR[appliesTo].length
}

/** One rule of a policy: a day counts when it is off by more than `minutes`. */
export interface PolicyRule {
  clockEvent: ClockEvent
  /** Minutes past the expected time a day may be off before it counts (per occurrence). */
  minutes: number
  /** Every n-th occurrence in the period raises a warning. */
  occurrenceCount: number
}

/** Legacy (kept for the barrel): Policies no longer have period blocks; a rule is the nearest thing. */
export type PolicyPeriod = PolicyRule

/** A penalty rule as it comes back inside a policy. */
export interface PolicyPenaltyRule {
  id: string
  /** The n-th warning in the period this penalty applies to. */
  afterCount: number
  period: 'week' | 'month' | 'year'
  penaltyType: 'half_day' | 'full_day' | 'percentage'
  /** Share of a day (50 for half day, 100 for full day). */
  percentage: number
  deduction: 'payroll' | 'leave' | 'both'
  leaveTypeId: string | null
  leaveTypeTitle: string | null
}

/** `WarningPolicyOut`. */
export interface WarningPolicy {
  id: string
  title: string
  appliesTo: AppliesTo
  period: TimeSpan
  /** Total grace minutes in a period before days start to count. */
  graceMinutes: number | null
  weekStartDay: Weekday | null
  weekEndDay: Weekday | null
  isActive: boolean
  rules: PolicyRule[]
  penalties: PolicyPenaltyRule[]
  /** Warnings raised under the policy (a policy with warnings cannot be deleted). */
  warningCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  /**
   * Read-only aliases added by the API layer for screens written against the old shape
   * (the dashboard): `policyName` = `appliesTo`, `timeSpan` = `period`.
   */
  readonly policyName: PolicyName
  readonly timeSpan: TimeSpan
}

/** `WarningPolicyIn`: body of `POST /warning/policies` and `PUT /warning/policies/{id}`. */
export interface WarningPolicyInput {
  title: string
  appliesTo: AppliesTo
  period: TimeSpan
  graceMinutes: number | null
  weekStartDay: Weekday | null
  weekEndDay: Weekday | null
  isActive: boolean
  rules: PolicyRule[]
  rowVersion?: string | undefined
}
