import type { AppliesTo, PolicyPenaltyRule } from './warning-policy.types'

/** Penalty periods: the n-th warning of a policy within a week, month or year. */
export const PENALTY_PERIODS = ['week', 'month', 'year'] as const
export type PenaltyPeriod = (typeof PENALTY_PERIODS)[number]

export const PENALTY_TYPES = ['half_day', 'full_day', 'percentage'] as const
export type PenaltyType = (typeof PENALTY_TYPES)[number]

/** Where the penalty is taken from. */
export const DEDUCTIONS = ['payroll', 'leave', 'both'] as const
export type Deduction = (typeof DEDUCTIONS)[number]

/** Legacy (kept for the barrel): The API has no scale; a penalty is a share of a day (`percentage`). */
export const SCALE_TYPES = ['number', 'percentage'] as const
/** Legacy (kept for the barrel): See {@link SCALE_TYPES}. */
export type ScaleType = (typeof SCALE_TYPES)[number]

/** Legacy (kept for the barrel): The API keeps no badge colour. */
export const BADGE_COLORS = ['red', 'green', 'blue'] as const
/** Legacy (kept for the barrel): See {@link BADGE_COLORS}. */
export type BadgeColor = (typeof BADGE_COLORS)[number]

/** One penalty rule of a policy (`PenaltyRuleOut`). */
export type PenaltyRule = PolicyPenaltyRule

/** One row of the Penalty list (`GET /warning/penalties`, `PenaltyListOut`): a rule with its policy. */
export interface WarningPenalty {
  id: string
  warningPolicyId: string
  policyTitle: string
  appliesTo: AppliesTo
  afterCount: number
  period: PenaltyPeriod
  penaltyType: PenaltyType
  percentage: number
  deduction: Deduction
  leaveTypeId: string | null
  leaveTypeTitle: string | null
  createdAt: string
}

/** `PenaltyRuleIn`. */
export interface PenaltyRuleInput {
  afterCount: number
  period: PenaltyPeriod
  penaltyType: PenaltyType
  /** Required for `percentage`; the server sets 50 / 100 for half / full day. */
  percentage: number | null
  deduction: Deduction
  /** Required when the deduction is `leave` or `both`. */
  leaveTypeId: string | null
}

/** `PenaltiesIn`: body of `PUT /warning/policies/{id}/penalties` (replaces the policy's rules). */
export interface WarningPenaltyInput {
  penalties: PenaltyRuleInput[]
  /** The policy's rowVersion. */
  rowVersion: string
}

/** A leave type the deduction can be taken from (`GET /leaves/types`, id and title only). */
export interface LeaveTypeOption {
  id: string
  title: string
}
