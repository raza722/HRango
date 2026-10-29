import {
  type Appraisal,
  APPRAISAL_STATUSES,
  type AppraisalDetail,
  type AppraisalForm,
  type AppraisalSummary,
  CHANGE_TYPES,
  type CheckIn,
  type CheckInInput,
  type Cycle,
  CYCLE_STATUSES,
  type CycleInput,
  type FinaliseInput,
  type Goal,
  GOAL_STATUSES,
  type GoalDetail,
  type GoalInput,
  type Kpi,
  type KpiInput,
  MEASURE_TYPES,
  type Outcome,
  OUTCOMES,
  type Overview,
  type ReviewInput,
} from '../types/performance.types'
import type {
  AppraisalDetailDto,
  AppraisalDto,
  AppraisalFormDto,
  AppraisalSummaryDto,
  CheckInDto,
  CheckInInDto,
  CycleDto,
  CycleInDto,
  FinaliseInDto,
  GoalDetailDto,
  GoalDto,
  GoalInDto,
  IdIn,
  KpiDto,
  KpiInDto,
  OverviewDto,
  ReviewInDto,
} from './performance.dto'

// --- ids, instants, enums ---------------------------------------------------------------------

/**
 * An id as a request body sends it: the API's ids are integers on the way in (strings on the
 * way out). Non-numeric ids (the mock's readable ones) go as they are.
 */
export const toApiId = (id: string): IdIn => (/^\d+$/.test(id) ? Number(id) : id)

const optionalId = (id: string | null): IdIn | null => (id ? toApiId(id) : null)

/** The API writes UTC instants without an offset; read them as UTC. */
export function instant(value: string): string
export function instant(value: string | null | undefined): string | null
export function instant(value: string | null | undefined): string | null {
  if (!value) return null
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
}

/**
 * Narrows a status the API sent to the feature's union. A value the screens do not know is
 * kept as it came (its chip then shows the raw text), so nothing is silently renamed.
 */
function oneOf<T extends string>(values: readonly T[], value: string): T {
  return (values.find((known) => known === value) ?? value) as T
}

const outcomeOf = (value: string | null): Outcome | null => (value ? oneOf(OUTCOMES, value) : null)

// --- goals ----------------------------------------------------------------------------------

export function toGoal(dto: GoalDto): Goal {
  return {
    id: dto.id,
    employeeId: dto.employeeId,
    employeeCode: dto.employeeCode,
    employeeName: dto.employeeName,
    departmentName: dto.departmentName,
    cycleId: dto.appraisalCycleId,
    cycleName: dto.appraisalCycleName,
    kpiId: dto.kpiId,
    kpiName: dto.kpiName,
    title: dto.title,
    description: dto.description,
    startDate: dto.startDate,
    dueDate: dto.dueDate,
    weight: dto.weight,
    targetValue: dto.targetValue,
    actualValue: dto.actualValue,
    progress: dto.progress,
    status: oneOf(GOAL_STATUSES, dto.status),
    isOverdue: dto.isOverdue,
    isLocked: dto.isLocked,
    completedAt: instant(dto.completedAt),
    createdAt: instant(dto.createdAt),
    updatedAt: instant(dto.updatedAt),
    rowVersion: dto.rowVersion,
  }
}

const toCheckIn = (dto: CheckInDto): CheckIn => ({
  id: dto.id,
  progress: dto.progress,
  actualValue: dto.actualValue,
  status: oneOf(GOAL_STATUSES, dto.status),
  comments: dto.comments,
  createdAt: instant(dto.createdAt),
  createdByName: dto.createdByName,
})

export const toGoalDetail = (dto: GoalDetailDto): GoalDetail => ({
  ...toGoal(dto),
  checkIns: [...dto.checkIns].map(toCheckIn).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
})

export const toGoalIn = (input: GoalInput): GoalInDto => ({
  employeeId: optionalId(input.employeeId),
  appraisalCycleId: optionalId(input.cycleId),
  kpiId: optionalId(input.kpiId),
  title: input.title,
  description: input.description,
  startDate: input.startDate,
  dueDate: input.dueDate,
  weight: input.weight,
  targetValue: input.targetValue,
  actualValue: input.actualValue,
  progress: input.progress,
  status: input.status,
  rowVersion: input.rowVersion,
})

export const toCheckInIn = (input: CheckInInput): CheckInInDto => ({
  progress: input.progress,
  actualValue: input.actualValue,
  status: input.status,
  comments: input.comments,
  rowVersion: input.rowVersion,
})

// --- KPIs -----------------------------------------------------------------------------------

export const toKpi = (dto: KpiDto): Kpi => ({
  id: dto.id,
  name: dto.name,
  keyResultArea: dto.keyResultArea,
  description: dto.description,
  measureType: oneOf(MEASURE_TYPES, dto.measureType ?? 'percentage'),
  targetValue: dto.targetValue,
  unit: dto.unit,
  defaultWeight: dto.defaultWeight,
  departmentId: dto.departmentId,
  departmentName: dto.departmentName,
  jobTitleId: dto.jobTitleId,
  jobTitleName: dto.jobTitleName,
  isActive: dto.isActive,
  inUse: dto.inUse,
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toKpiIn = (input: KpiInput): KpiInDto => ({
  name: input.name,
  keyResultArea: input.keyResultArea,
  description: input.description,
  measureType: input.measureType,
  targetValue: input.targetValue,
  unit: input.unit,
  defaultWeight: input.defaultWeight,
  departmentId: optionalId(input.departmentId),
  jobTitleId: optionalId(input.jobTitleId),
  isActive: input.isActive,
  rowVersion: input.rowVersion,
})

// --- cycles and forms ------------------------------------------------------------------------

export const toCycle = (dto: CycleDto): Cycle => ({
  id: dto.id,
  name: dto.name,
  formId: dto.appraisalFormId,
  formName: dto.appraisalFormName,
  startDate: dto.startDate,
  endDate: dto.endDate,
  selfReviewDueDate: dto.selfReviewDueDate,
  managerReviewDueDate: dto.managerReviewDueDate,
  status: oneOf(CYCLE_STATUSES, dto.status),
  launchedAt: instant(dto.launchedAt),
  closedAt: instant(dto.closedAt),
  participants: dto.participants,
  selfReview: dto.selfReview,
  managerReview: dto.managerReview,
  reviewed: dto.reviewed,
  finalised: dto.finalised,
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toCycleIn = (input: CycleInput): CycleInDto => ({
  name: input.name,
  appraisalFormId: toApiId(input.formId),
  startDate: input.startDate,
  endDate: input.endDate,
  selfReviewDueDate: input.selfReviewDueDate,
  managerReviewDueDate: input.managerReviewDueDate,
  rowVersion: input.rowVersion,
})

export const toAppraisalForm = (dto: AppraisalFormDto): AppraisalForm => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  ratingScaleId: dto.ratingScaleId,
  ratingScaleName: dto.ratingScaleName,
  goalsWeight: dto.goalsWeight,
  hasSelfReview: dto.hasSelfReview,
  isActive: dto.isActive,
  criteria: [...dto.criteria]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((criterion) => ({
      id: criterion.id,
      kpiId: criterion.kpiId ?? null,
      kpiName: criterion.kpiName ?? null,
      name: criterion.name,
      description: criterion.description ?? null,
      weight: criterion.weight,
    })),
})

// --- appraisals and reviews -------------------------------------------------------------------

export const toAppraisal = (dto: AppraisalDto): Appraisal => ({
  id: dto.id,
  cycleId: dto.appraisalCycleId,
  cycleName: dto.appraisalCycleName,
  cycleStatus: oneOf(CYCLE_STATUSES, dto.cycleStatus),
  periodStart: dto.periodStart,
  periodEnd: dto.periodEnd,
  selfReviewDueDate: dto.selfReviewDueDate,
  managerReviewDueDate: dto.managerReviewDueDate,
  formId: dto.appraisalFormId,
  formName: dto.appraisalFormName,
  hasSelfReview: dto.hasSelfReview,
  goalsWeight: dto.goalsWeight,
  employeeId: dto.employeeId,
  employeeCode: dto.employeeCode,
  employeeName: dto.employeeName,
  departmentName: dto.departmentName,
  jobTitleName: dto.jobTitleName,
  reviewerId: dto.reviewerEmployeeId,
  reviewerName: dto.reviewerName,
  status: oneOf(APPRAISAL_STATUSES, dto.status),
  goalsScore: dto.goalsScore,
  selfScore: dto.selfScore,
  managerScore: dto.managerScore,
  finalScore: dto.finalScore,
  finalRatingLabel: dto.finalRatingLabel,
  outcome: outcomeOf(dto.outcome),
  selfSubmittedAt: instant(dto.selfSubmittedAt),
  managerSubmittedAt: instant(dto.managerSubmittedAt),
  finalisedAt: instant(dto.finalisedAt),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toAppraisalDetail = (dto: AppraisalDetailDto): AppraisalDetail => ({
  ...toAppraisal(dto),
  selfComments: dto.selfComments,
  managerComments: dto.managerComments,
  finalComments: dto.finalComments,
  developmentNeeds: dto.developmentNeeds,
  letterFile: dto.letterFile
    ? { id: dto.letterFile.id, name: dto.letterFile.name ?? null, url: dto.letterFile.url }
    : null,
  ratings: [...dto.ratings]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => ({
      criterionId: row.criterionId,
      kpiName: row.kpiName,
      name: row.name,
      description: row.description,
      weight: row.weight,
      selfRating: row.selfRating,
      selfComment: row.selfComment,
      managerRating: row.managerRating,
      managerComment: row.managerComment,
    })),
  goals: dto.goals.map((goal) => ({ ...goal, status: oneOf(GOAL_STATUSES, goal.status) })),
  scale: [...dto.scale]
    .sort((a, b) => a.score - b.score)
    .map((level) => ({
      score: level.score,
      label: level.label,
      description: level.description ?? null,
    })),
  increment: dto.increment
    ? { ...dto.increment, changeType: oneOf(CHANGE_TYPES, dto.increment.changeType) }
    : null,
})

export const toReviewIn = (input: ReviewInput): ReviewInDto => ({
  ratings: input.ratings.map((row) => ({
    criterionId: toApiId(row.criterionId),
    rating: row.rating,
    comment: row.comment,
  })),
  comments: input.comments,
  developmentNeeds: input.developmentNeeds,
  submit: input.submit,
  rowVersion: input.rowVersion,
})

export const toFinaliseIn = (input: FinaliseInput): FinaliseInDto => ({
  finalScore: input.finalScore,
  finalComments: input.finalComments,
  outcome: input.outcome,
  increment: input.increment,
  rowVersion: input.rowVersion,
})

// --- overview -------------------------------------------------------------------------------

const toSummary = (dto: AppraisalSummaryDto): AppraisalSummary => ({
  id: dto.id,
  cycleId: dto.appraisalCycleId,
  cycleName: dto.appraisalCycleName,
  periodStart: dto.periodStart,
  periodEnd: dto.periodEnd,
  status: oneOf(APPRAISAL_STATUSES, dto.status),
  selfReviewDueDate: dto.selfReviewDueDate,
  managerReviewDueDate: dto.managerReviewDueDate,
  finalScore: dto.finalScore,
  finalRatingLabel: dto.finalRatingLabel,
  outcome: outcomeOf(dto.outcome),
  finalisedAt: instant(dto.finalisedAt),
})

export const toOverview = (dto: OverviewDto): Overview => ({
  employeeId: dto.employeeId,
  employeeCode: dto.employeeCode,
  employeeName: dto.employeeName,
  departmentName: dto.departmentName,
  jobTitleName: dto.jobTitleName,
  goals: dto.goals,
  upcomingGoals: dto.upcomingGoals.map((goal) => ({
    ...goal,
    status: oneOf(GOAL_STATUSES, goal.status),
  })),
  appraisals: [...dto.appraisals]
    .map(toSummary)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
})
