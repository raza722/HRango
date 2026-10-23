import type { PolicyName, TimeSpan, Weekday } from './warning-policy.types'

/** "Type Of Scale": whether Points are a count or a percentage. */
export const SCALE_TYPES = ['number', 'percentage'] as const
export type ScaleType = (typeof SCALE_TYPES)[number]

export const PENALTY_TYPES = ['half-day', 'full-day'] as const
export type PenaltyType = (typeof PENALTY_TYPES)[number]

/** Where the penalty is taken from. */
export const DEDUCTIONS = ['payroll', 'leave', 'both'] as const
export type Deduction = (typeof DEDUCTIONS)[number]

/** Colour of the badge shown next to an employee who received this penalty. */
export const BADGE_COLORS = ['red', 'green', 'blue'] as const
export type BadgeColor = (typeof BADGE_COLORS)[number]

/** One "+ Add Penalty" block: when it triggers and what it costs. */
export interface PenaltyRule {
  /** Warnings within the time span that trigger the penalty. */
  count: number
  timeSpan: TimeSpan
  /** Weekly: weekday; monthly/yearly: ISO date `yyyy-MM-dd`. */
  startDay: string
  endDay: string
  /** Day of the period the penalty is applied on, 1-based. */
  day: number
  /** Weekly only: days the rule watches. */
  weekdays: Weekday[]
  /** Window the rule watches, `HH:mm`. */
  from: string
  to: string
  /** Points deducted (or percent, when the scale is `percentage`). */
  points: number
  penaltyType: PenaltyType
  deduction: Deduction
  badgeColor: BadgeColor
}

/** A penalty configuration ("Warning Policy" form + its penalty rules). */
export interface WarningPenalty {
  id: string
  policyName: PolicyName
  title: string
  scaleType: ScaleType
  rules: PenaltyRule[]
  createdAt: string
  updatedAt: string
}

/** Body of `POST /warning-penalties` and `PUT /warning-penalties/:id`. */
export type WarningPenaltyInput = Omit<WarningPenalty, 'id' | 'createdAt' | 'updatedAt'>
