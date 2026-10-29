/*
 * The wire shapes of `/api/performance/…` as the OpenAPI spec (26 Oct 2026) defines them
 * (`components.schemas`). Ids come back as strings and go in as integers; dates are
 * `yyyy-MM-dd`, instants ISO date-times. Nothing here is used by the screens directly: the
 * mappers in `performance.mappers.ts` turn these into the feature's types.
 */

export type GoalStatusDto = 'not_started' | 'in_progress' | 'completed' | 'cancelled'
export type CycleStatusDto = 'draft' | 'active' | 'closed'
export type AppraisalStatusDto =
  'draft' | 'self_review' | 'manager_review' | 'reviewed' | 'finalised'
export type MeasureTypeDto = 'percentage' | 'number' | 'amount' | 'rating' | 'yes_no'
export type OutcomeDto = 'no_change' | 'increment' | 'promotion' | 'improvement_plan'
export type ChangeTypeDto = 'flat' | 'percent'
export type ScopeTabDto = 'my' | 'team' | 'all'

/** An id as a request body carries it: numeric ids as numbers. */
export type IdIn = number | string

/** `FileRef`: a file on a record, with a signed link. */
export interface FileRefDto {
  id: string
  name?: string | null
  url: string
}

// --- goals ----------------------------------------------------------------------------------

/** `CheckInOut`. */
export interface CheckInDto {
  id: string
  progress: number
  actualValue: number | null
  status: string
  comments: string | null
  createdAt: string
  createdByName: string | null
}

/** `GoalOut`. */
export interface GoalDto {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  appraisalCycleId: string | null
  appraisalCycleName: string | null
  kpiId: string | null
  kpiName: string | null
  title: string
  description: string | null
  startDate: string | null
  dueDate: string
  weight: number
  targetValue: number | null
  actualValue: number | null
  progress: number
  status: string
  isOverdue: boolean
  isLocked: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `GoalDetailOut`: the goal with its check-ins. */
export interface GoalDetailDto extends GoalDto {
  checkIns: CheckInDto[]
}

/** `GoalIn` (required: title, dueDate). */
export interface GoalInDto {
  employeeId?: IdIn | null
  appraisalCycleId?: IdIn | null
  kpiId?: IdIn | null
  title: string
  description?: string | null
  startDate?: string | null
  dueDate: string
  /** 0–100 (default 1). */
  weight?: number
  targetValue?: number | null
  actualValue?: number | null
  /** 0–100. */
  progress?: number | null
  status?: GoalStatusDto | null
  comments?: string | null
  rowVersion?: string | null
}

/** `CheckInIn` (required: rowVersion). */
export interface CheckInInDto {
  progress?: number | null
  actualValue?: number | null
  status?: GoalStatusDto | null
  comments?: string | null
  rowVersion: string
}

// --- KPIs -----------------------------------------------------------------------------------

/** `KpiOut`. */
export interface KpiDto {
  id: string
  name: string
  keyResultArea: string | null
  description: string | null
  measureType: string | null
  targetValue: number | null
  unit: string | null
  defaultWeight: number | null
  departmentId: string | null
  departmentName: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  isActive: boolean
  inUse: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `KpiIn` (required: name). */
export interface KpiInDto {
  name: string
  keyResultArea?: string | null
  description?: string | null
  measureType?: MeasureTypeDto
  targetValue?: number | null
  unit?: string | null
  defaultWeight?: number | null
  departmentId?: IdIn | null
  jobTitleId?: IdIn | null
  isActive?: boolean
  rowVersion?: string | null
}

// --- cycles ---------------------------------------------------------------------------------

/** `CycleOut`: with the counts of its appraisals by stage. */
export interface CycleDto {
  id: string
  name: string
  appraisalFormId: string
  appraisalFormName: string
  startDate: string
  endDate: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  status: string
  launchedAt: string | null
  closedAt: string | null
  participants: number
  selfReview: number
  managerReview: number
  reviewed: number
  finalised: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `CycleIn` (required: name, appraisalFormId, startDate, endDate). */
export interface CycleInDto {
  name: string
  appraisalFormId: IdIn
  startDate: string
  endDate: string
  selfReviewDueDate?: string | null
  managerReviewDueDate?: string | null
  rowVersion?: string | null
}

/** `ParticipantsIn`: people, a whole department, or both. */
export interface ParticipantsInDto {
  employeeIds?: IdIn[]
  departmentId?: IdIn | null
}

/** `ParticipantsOut`. */
export interface ParticipantsOutDto {
  cycle: CycleDto
  added: number
}

/** `app__schemas__performance__RowVersionIn`. */
export interface RowVersionInDto {
  rowVersion: string
}

// --- appraisal forms and rating scales -------------------------------------------------------

/** `ScaleLevel`. */
export interface ScaleLevelDto {
  score: number
  label: string
  description?: string | null
}

/** `RatingScaleOut`. */
export interface RatingScaleDto {
  id: string
  name: string
  isDefault: boolean
  isActive: boolean
  minScore: number | null
  maxScore: number | null
  levels: ScaleLevelDto[]
  inUse: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `CriterionOut`. */
export interface CriterionDto {
  id: string
  kpiId?: string | null
  kpiName?: string | null
  name: string
  description?: string | null
  weight: number
  sortOrder?: number | null
}

/** `AppraisalFormOut`. */
export interface AppraisalFormDto {
  id: string
  name: string
  description: string | null
  ratingScaleId: string
  ratingScaleName: string
  goalsWeight: number
  hasSelfReview: boolean
  isActive: boolean
  criteria: CriterionDto[]
  inUse: number
  isLocked: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

// --- appraisals and reviews -------------------------------------------------------------------

/** `AppraisalOut`. */
export interface AppraisalDto {
  id: string
  appraisalCycleId: string
  appraisalCycleName: string
  cycleStatus: string
  periodStart: string
  periodEnd: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  appraisalFormId: string
  appraisalFormName: string
  hasSelfReview: boolean
  goalsWeight: number
  ratingScaleId: string
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  jobTitleName: string | null
  reviewerEmployeeId: string | null
  reviewerName: string | null
  status: string
  goalsScore: number | null
  selfScore: number | null
  managerScore: number | null
  finalScore: number | null
  finalRatingLabel: string | null
  outcome: string | null
  selfSubmittedAt: string | null
  managerSubmittedAt: string | null
  finalisedAt: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `RatingRowOut`: one criterion with both reviews' ratings. */
export interface RatingRowDto {
  criterionId: string
  kpiId: string | null
  kpiName: string | null
  name: string
  description: string | null
  weight: number
  sortOrder: number | null
  selfRating: number | null
  selfComment: string | null
  managerRating: number | null
  managerComment: string | null
}

/** `AppraisalGoalOut`. */
export interface AppraisalGoalDto {
  id: string
  title: string
  dueDate: string
  weight: number
  progress: number
  status: string
}

/** `ProposalBriefOut`: the increment a finalised appraisal proposed. */
export interface ProposalBriefDto {
  id: string
  changeType: string
  changeValue: number
  effectiveDate: string
  status: string
}

/** `AppraisalDetailOut`. */
export interface AppraisalDetailDto extends AppraisalDto {
  selfComments: string | null
  managerComments: string | null
  finalComments: string | null
  developmentNeeds: string | null
  letterFile: FileRefDto | null
  ratings: RatingRowDto[]
  goals: AppraisalGoalDto[]
  scale: ScaleLevelDto[]
  increment: ProposalBriefDto | null
}

/** `RatingIn`. */
export interface RatingInDto {
  criterionId: IdIn
  /** 0–100, on the form's rating scale. */
  rating?: number | null
  comment?: string | null
}

/** `ReviewIn` (required: rowVersion); `submit: false` saves a draft. */
export interface ReviewInDto {
  ratings?: RatingInDto[]
  comments?: string | null
  developmentNeeds?: string | null
  submit?: boolean
  rowVersion: string
}

/** `IncrementIn`. */
export interface IncrementInDto {
  changeType: ChangeTypeDto
  changeValue: number
  effectiveDate: string
}

/** `FinaliseIn` (required: rowVersion). */
export interface FinaliseInDto {
  finalScore?: number | null
  finalComments?: string | null
  outcome?: OutcomeDto
  increment?: IncrementInDto | null
  letterFileId?: IdIn | null
  rowVersion: string
}

// --- overview -------------------------------------------------------------------------------

/** `GoalCountsOut`. */
export interface GoalCountsDto {
  total: number
  notStarted: number
  inProgress: number
  completed: number
  cancelled: number
  overdue: number
  weightedProgress: number | null
}

/** `UpcomingGoalOut`. */
export interface UpcomingGoalDto {
  id: string
  title: string
  dueDate: string
  progress: number
  status: string
  isOverdue: boolean
}

/** `AppraisalSummaryOut`. */
export interface AppraisalSummaryDto {
  id: string
  appraisalCycleId: string
  appraisalCycleName: string
  periodStart: string
  periodEnd: string
  status: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  finalScore: number | null
  finalRatingLabel: string | null
  outcome: string | null
  finalisedAt: string | null
}

/** `OverviewOut`. */
export interface OverviewDto {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  jobTitleName: string | null
  goals: GoalCountsDto
  upcomingGoals: UpcomingGoalDto[]
  appraisals: AppraisalSummaryDto[]
}

/** `GET /organisation/lookups/{kind}` row (the KPI and participants pickers). */
export interface OrgLookupDto {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}
