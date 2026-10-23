import type {
  FlowStep,
  PersonRef,
  RequestCounts,
  RequestHistoryEntry,
  RequestStatus,
} from '@/features/requests'
import type { Paginated } from '@/types/api'

/*
 * The Leaves module (sidebar → Leaves): My Leaves and Leave Applications list
 * the same leave requests as Requests → Leave; Settings holds the general
 * rules, the leave types and the leave policies that decide who may ask for
 * what, and how many days they have.
 */

/** "Single" is one day (or part of one); "Multiple" spans several. */
export type LeaveCategory = 'single' | 'multiple'
export const LEAVE_CATEGORIES: readonly LeaveCategory[] = ['single', 'multiple']

/** What the signed-in person may do with an application (decided by the server). */
export type LeaveApplicationAction = 'view' | 'cancel' | 'decide'

export interface LeaveBalance {
  /** Days a year ("Balance"). */
  total: number
  /** Days taken: approved, or also pending when Approve Leave on Status is Pending. */
  availed: number
  /** Days waiting for approval and held back from Available. */
  pending: number
  available: number
}

export interface LeaveApplicationEmployee extends PersonRef {
  department: string
  designation: string
  photoUrl: string | null
}

/** A leave request as the Leaves lists show it. */
export interface LeaveApplication {
  id: string
  code: string
  status: RequestStatus
  employee: LeaveApplicationEmployee
  category: LeaveCategory
  leaveTypeId: string
  leaveTypeTitle: string
  leaveTypeCode: string
  /** The first and last day. */
  from: string
  to: string
  /** The days counted. */
  dates: string[]
  /** Days taken (0.5 for a half day). */
  count: number
  short: boolean
  shortTypeLabel: string | null
  rosterTitle: string
  reason: string
  attachment: string | null
  /** The type asks for an attachment and none was given (allowed with a note). */
  attachmentMissing: boolean
  appliedAt: string
  /** The authority whose decision is awaited ("Line Manager"), while pending. */
  nextAuthority: string | null
  nextApprover: PersonRef | null
  flow: FlowStep[]
  cancelReason: string | null
  actions: LeaveApplicationAction[]
  /** The person's balance of this leave type now. */
  balance: LeaveBalance
}

export interface LeaveApplicationPage extends Paginated<LeaveApplication> {
  counts: RequestCounts
}

export interface LeaveApplicationDetail {
  application: LeaveApplication
  history: RequestHistoryEntry[]
}

export interface LeaveApplicationListParams {
  scope: 'my' | 'all'
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: Record<string, string | undefined> | undefined
}

export interface LeaveApplyInput {
  category: LeaveCategory
  leaveTypeId: string
  from: string
  to: string
  reason: string
  attachment: string | null
}

export interface LeaveDecisionInput {
  decision: 'approve' | 'reject'
  remarks: string
}

// --- Settings → General Settings ------------------------------------------------------------------

export const FINAL_APPROVAL_AUTHORITIES = ['hr-manager', 'line-manager', 'department-head'] as const
export type FinalApprovalBy = (typeof FINAL_APPROVAL_AUTHORITIES)[number]

export const APPROVE_ON_STATUSES = ['approved', 'pending'] as const
export type ApproveOnStatus = (typeof APPROVE_ON_STATUSES)[number]

export interface LeaveSettings {
  /** Whose approval completes an application (recorded as the final authority). */
  finalApprovalBy: FinalApprovalBy
  /** The status at which an application counts as leave taken in the balances. */
  approveOnStatus: ApproveOnStatus
  /** Back-dated applications must be posted within the type's Back Date Leave Limit in Days. */
  postDeadline: boolean
}

// --- Settings → Leave Types -----------------------------------------------------------------------

export const LEAVE_GENDER_RULES = ['any', 'male', 'female'] as const
export type LeaveGenderRule = (typeof LEAVE_GENDER_RULES)[number]

export const LEAVE_MARITAL_RULES = ['any', 'married', 'single'] as const
export type LeaveMaritalRule = (typeof LEAVE_MARITAL_RULES)[number]

export const LEAVE_TENURES = ['yearly', 'monthly', 'employment'] as const
export type LeaveTenure = (typeof LEAVE_TENURES)[number]

export const BALANCE_BASES = ['flat', 'experience'] as const
export type BalanceBasis = (typeof BALANCE_BASES)[number]

export const ATTACHMENT_RULES = ['refuse', 'note'] as const
export type AttachmentRule = (typeof ATTACHMENT_RULES)[number]

export const SHORT_SLAB_UNITS = ['hours', 'minutes'] as const
export type ShortSlabUnit = (typeof SHORT_SLAB_UNITS)[number]

/** Balance According to = Experience: the balance of people with this much service. */
export interface ExperienceSlab {
  minMonths: number
  maxMonths: number
  balance: number
}

/** A short leave the type allows: its length and the share of a day it costs. */
export interface ShortLeaveSlab {
  name: string
  balance: number
  unit: ShortSlabUnit
  value: number
}

export interface LeaveTypeInput {
  title: string
  shortCode: string
  leavesAllowed: number
  // The switches, in the design's order.
  probationType: boolean
  active: boolean
  autoAllotment: boolean
  autoBalanceOnJoiningMonth: boolean
  composite: boolean
  shortLeave: boolean
  showInPayslip: boolean
  deductible: boolean
  sandwich: boolean
  sandwichAcrossTypes: boolean
  earnedBalance: boolean
  backDate: boolean
  /** With Can Apply for Back Date. */
  backDateLimitDays: number | null
  futureDateLimit: boolean
  attachmentRequired: boolean
  /** With Attachment Required. */
  attachmentRule: AttachmentRule | null
  encashment: boolean
  /** With Encashment. */
  encashmentMin: number | null
  encashmentMax: number | null
  carryForward: boolean
  proRated: boolean
  // Pre Condition.
  gender: LeaveGenderRule
  maritalStatus: LeaveMaritalRule
  applyInProbation: boolean
  minExperienceMonths: number
  maxApplications: number | null
  gapMonths: number | null
  // Balance Settings.
  tenure: LeaveTenure
  balanceBasis: BalanceBasis
  /** "Accumulative Count": how many tenures unused days may accumulate over (null: none). */
  accumulativeCount: number | null
  experienceSlabs: ExperienceSlab[]
  shortLeaveSlabs: ShortLeaveSlab[]
}

export interface LeaveType extends LeaveTypeInput {
  id: string
  /** Leave applications of this type; a type in use cannot be deleted. */
  inUse: number
  createdAt: string
}

export interface LeaveTypeListParams {
  page: number
  pageSize: number
  q?: string | undefined
  status?: string | undefined
}

// --- Settings → Leave Policies --------------------------------------------------------------------

export const POLICY_LEVELS = ['company', 'employee'] as const
export type PolicyLevel = (typeof POLICY_LEVELS)[number]

/** The frame's two policies: "Leave Distribution Policy" and "Half leave & Short leave". */
export const POLICY_KINDS = ['distribution', 'half-short'] as const
export type PolicyKind = (typeof POLICY_KINDS)[number]

export interface LeavePolicyInput {
  title: string
  /** "Policy *": what the policy decides. */
  kind: PolicyKind
  level: PolicyLevel
  /** "Half leave & Short leave". */
  allowHalfDay: boolean
  allowShortLeave: boolean
  /** The "Leave Policy" switch of the list: the policy is in force for its people. */
  enforced: boolean
  /** The "Status" switch of the list. */
  active: boolean
}

export interface LeavePolicy extends LeavePolicyInput {
  id: string
  /** Employee-level policies: who is enrolled (a company-level one covers everyone). */
  enrolled: PersonRef[]
  /** "Enroll Employee": how many people the policy covers. */
  enrolledCount: number
  createdAt: string
}

/** What the signed-in person's policies allow (Apply Leave reads it). */
export interface LeaveCoverage {
  /** A Leave Distribution Policy in force covers the person, so leave may be applied for. */
  distribution: boolean
  halfDay: boolean
  shortLeave: boolean
}

// --- Look-ups -------------------------------------------------------------------------------------

export interface LeavesPerson extends PersonRef {
  department: string
  designation: string
  active: boolean
}

/** A leave type the signed-in person may apply for, with their balance of it. */
export interface LeaveTypeOffer {
  id: string
  title: string
  shortCode: string
  attachmentRequired: boolean
  attachmentRule: AttachmentRule | null
  /** The type may be taken for days before today. */
  backDate: boolean
  deductible: boolean
  balance: LeaveBalance
}

export interface LeavesLookups {
  me: LeavesPerson
  employees: LeavesPerson[]
  departments: string[]
  /** Every leave type, for the filters and the policies. */
  leaveTypes: { id: string; title: string; shortCode: string; active: boolean }[]
  /** The types offered to the signed-in person on Apply Leave. */
  offered: LeaveTypeOffer[]
  /** Everyone's balance of every active type, by employee id and type id. */
  balances: Record<string, Record<string, LeaveBalance>>
  /** What the signed-in person's leave policies allow. */
  coverage: LeaveCoverage
  settings: LeaveSettings
  rosters: { id: string; title: string }[]
}
