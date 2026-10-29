/*
 * The Performance module's own types: what the screens work with. They follow the API's
 * records (see `api/performance.dto.ts`) with the enums narrowed and instants made explicit
 * UTC; the mappers in `api/performance.mappers.ts` build them.
 */

export const SCOPE_TABS = ['my', 'team', 'all'] as const
/** My / Team / All: whose goals, appraisals or reviews a list holds. */
export type ScopeTab = (typeof SCOPE_TABS)[number]

export const GOAL_STATUSES = ['not_started', 'in_progress', 'completed', 'cancelled'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const CYCLE_STATUSES = ['draft', 'active', 'closed'] as const
export type CycleStatus = (typeof CYCLE_STATUSES)[number]

export const APPRAISAL_STATUSES = [
  'draft',
  'self_review',
  'manager_review',
  'reviewed',
  'finalised',
] as const
export type AppraisalStatus = (typeof APPRAISAL_STATUSES)[number]

export const MEASURE_TYPES = ['percentage', 'number', 'amount', 'rating', 'yes_no'] as const
export type MeasureType = (typeof MEASURE_TYPES)[number]

export const OUTCOMES = ['no_change', 'increment', 'promotion', 'improvement_plan'] as const
export type Outcome = (typeof OUTCOMES)[number]

export const CHANGE_TYPES = ['flat', 'percent'] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

// --- goals ----------------------------------------------------------------------------------

export interface CheckIn {
  id: string
  progress: number
  actualValue: number | null
  status: GoalStatus
  comments: string | null
  createdAt: string
  createdByName: string | null
}

export interface Goal {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  cycleId: string | null
  cycleName: string | null
  kpiId: string | null
  kpiName: string | null
  title: string
  description: string | null
  startDate: string | null
  dueDate: string
  weight: number
  targetValue: number | null
  actualValue: number | null
  /** 0–100. */
  progress: number
  status: GoalStatus
  isOverdue: boolean
  /** Its cycle is closed (or its appraisal finalised): no edits, check-ins or delete. */
  isLocked: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface GoalDetail extends Goal {
  /** Newest first. */
  checkIns: CheckIn[]
}

/** `GET /performance/goals` query. */
export interface GoalListParams {
  tab: ScopeTab
  employeeId?: string | undefined
  status?: GoalStatus | undefined
  cycleId?: string | undefined
  overdue?: boolean | undefined
  dueFrom?: string | undefined
  dueTo?: string | undefined
  q?: string | undefined
  page: number
  pageSize: number
}

/** What the goal form saves (Add / Edit). */
export interface GoalInput {
  employeeId: string | null
  cycleId: string | null
  kpiId: string | null
  title: string
  description: string | null
  startDate: string | null
  dueDate: string
  weight: number
  targetValue: number | null
  actualValue: number | null
  progress: number | null
  status: GoalStatus | null
  rowVersion: string | null
}

export interface CheckInInput {
  progress: number | null
  actualValue: number | null
  status: GoalStatus | null
  comments: string | null
  rowVersion: string
}

// --- KPIs -----------------------------------------------------------------------------------

export interface Kpi {
  id: string
  name: string
  keyResultArea: string | null
  description: string | null
  measureType: MeasureType
  targetValue: number | null
  unit: string | null
  defaultWeight: number | null
  departmentId: string | null
  departmentName: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  isActive: boolean
  /** Goals and appraisal criteria that use it (a used KPI cannot be deleted). */
  inUse: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface KpiListParams {
  q?: string | undefined
  keyResultArea?: string | undefined
  departmentId?: string | undefined
  isActive?: boolean | undefined
  page: number
  pageSize: number
}

export interface KpiInput {
  name: string
  keyResultArea: string | null
  description: string | null
  measureType: MeasureType
  targetValue: number | null
  unit: string | null
  defaultWeight: number | null
  departmentId: string | null
  jobTitleId: string | null
  isActive: boolean
  rowVersion: string | null
}

// --- cycles and forms ------------------------------------------------------------------------

export interface Cycle {
  id: string
  name: string
  formId: string
  formName: string
  startDate: string
  endDate: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  status: CycleStatus
  launchedAt: string | null
  closedAt: string | null
  /** Appraisals in the cycle, and how many are at each stage. */
  participants: number
  selfReview: number
  managerReview: number
  reviewed: number
  finalised: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface CycleListParams {
  status?: CycleStatus | undefined
  q?: string | undefined
  page: number
  pageSize: number
}

export interface CycleInput {
  name: string
  formId: string
  startDate: string
  endDate: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  rowVersion: string | null
}

export interface ScaleLevel {
  score: number
  label: string
  description: string | null
}

export interface Criterion {
  id: string
  kpiId: string | null
  kpiName: string | null
  name: string
  description: string | null
  weight: number
}

/** An appraisal form: what a cycle reviews (criteria, rating scale, goals weight, self review). */
export interface AppraisalForm {
  id: string
  name: string
  description: string | null
  ratingScaleId: string
  ratingScaleName: string
  /** Share of the final score that comes from goals, 0–100. */
  goalsWeight: number
  hasSelfReview: boolean
  isActive: boolean
  criteria: Criterion[]
}

// --- appraisals and reviews -------------------------------------------------------------------

export interface Appraisal {
  id: string
  cycleId: string
  cycleName: string
  cycleStatus: CycleStatus
  periodStart: string
  periodEnd: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  formId: string
  formName: string
  hasSelfReview: boolean
  goalsWeight: number
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  jobTitleName: string | null
  reviewerId: string | null
  reviewerName: string | null
  status: AppraisalStatus
  goalsScore: number | null
  selfScore: number | null
  managerScore: number | null
  finalScore: number | null
  finalRatingLabel: string | null
  outcome: Outcome | null
  selfSubmittedAt: string | null
  managerSubmittedAt: string | null
  finalisedAt: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface RatingRow {
  criterionId: string
  kpiName: string | null
  name: string
  description: string | null
  weight: number
  selfRating: number | null
  selfComment: string | null
  managerRating: number | null
  managerComment: string | null
}

export interface AppraisalGoal {
  id: string
  title: string
  dueDate: string
  weight: number
  progress: number
  status: GoalStatus
}

export interface IncrementProposal {
  id: string
  changeType: ChangeType
  changeValue: number
  effectiveDate: string
  status: string
}

export interface AppraisalDetail extends Appraisal {
  selfComments: string | null
  managerComments: string | null
  finalComments: string | null
  developmentNeeds: string | null
  letterFile: { id: string; name: string | null; url: string } | null
  ratings: RatingRow[]
  goals: AppraisalGoal[]
  /** The rating scale's levels, lowest first. */
  scale: ScaleLevel[]
  increment: IncrementProposal | null
}

/** `GET /performance/appraisals` and `/reviews` query. */
export interface AppraisalListParams {
  tab: ScopeTab
  cycleId?: string | undefined
  status?: AppraisalStatus | undefined
  employeeId?: string | undefined
  q?: string | undefined
  page: number
  pageSize: number
}

export interface ReviewInput {
  ratings: { criterionId: string; rating: number | null; comment: string | null }[]
  comments: string | null
  developmentNeeds: string | null
  submit: boolean
  rowVersion: string
}

export interface FinaliseInput {
  finalScore: number | null
  finalComments: string | null
  outcome: Outcome
  increment: { changeType: ChangeType; changeValue: number; effectiveDate: string } | null
  rowVersion: string
}

// --- overview -------------------------------------------------------------------------------

export interface GoalCounts {
  total: number
  notStarted: number
  inProgress: number
  completed: number
  cancelled: number
  overdue: number
  /** Progress weighted by goal weight, 0–100; null without goals. */
  weightedProgress: number | null
}

export interface UpcomingGoal {
  id: string
  title: string
  dueDate: string
  progress: number
  status: GoalStatus
  isOverdue: boolean
}

export interface AppraisalSummary {
  id: string
  cycleId: string
  cycleName: string
  periodStart: string
  periodEnd: string
  status: AppraisalStatus
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  finalScore: number | null
  finalRatingLabel: string | null
  outcome: Outcome | null
  finalisedAt: string | null
}

export interface Overview {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  jobTitleName: string | null
  goals: GoalCounts
  upcomingGoals: UpcomingGoal[]
  /** Newest cycle first. */
  appraisals: AppraisalSummary[]
}

export interface OrgItem {
  id: string
  name: string
}
