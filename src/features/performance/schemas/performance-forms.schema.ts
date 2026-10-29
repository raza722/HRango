import { z } from 'zod'

import {
  type AppraisalDetail,
  CHANGE_TYPES,
  type CheckInInput,
  type Cycle,
  type CycleInput,
  type FinaliseInput,
  type Goal,
  GOAL_STATUSES,
  type GoalInput,
  type Kpi,
  type KpiInput,
  MEASURE_TYPES,
  OUTCOMES,
  type ReviewInput,
} from '../types/performance.types'
import { toNumberOrNull, toText } from '../utils/format'

/*
 * The Performance forms: Zod schemas over the inputs as typed (numbers are text until saved),
 * with the API's limits (lengths, 0–100 weights and progress, dates in order), and the mappers
 * between a record, the form, and what the API takes.
 */

interface NumberRule {
  label: string
  min?: number
  max?: number
  required?: boolean
  /** Must be above `min` (not equal). */
  above?: boolean
  /** At most this many decimals. */
  decimals?: number
}

/** A number typed as text: empty allowed unless required, then the range. */
function numberText({ label, min, max, required = false, above = false, decimals }: NumberRule) {
  return z.string().superRefine((value, ctx) => {
    if (value.trim() === '') {
      if (required) ctx.addIssue({ code: 'custom', message: `Enter the ${label}` })
      return
    }
    const number = toNumberOrNull(value)
    if (number === null) {
      ctx.addIssue({ code: 'custom', message: `Enter the ${label} as a number` })
      return
    }
    if (min !== undefined && (above ? number <= min : number < min)) {
      ctx.addIssue({
        code: 'custom',
        message: above
          ? `The ${label} must be above ${String(min)}`
          : `The ${label} can't be below ${String(min)}`,
      })
    }
    if (max !== undefined && number > max) {
      ctx.addIssue({ code: 'custom', message: `The ${label} can't be above ${String(max)}` })
    }
    const places = value.trim().split('.')[1]?.length ?? 0
    if (decimals !== undefined && places > decimals) {
      ctx.addIssue({
        code: 'custom',
        message: `Use at most ${String(decimals)} decimal places`,
      })
    }
  })
}

const limited = (max: number) =>
  z.string().max(max, `Keep it within ${max.toLocaleString('en-US')} characters`)

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

// --- goal -------------------------------------------------------------------------------------

export const goalFormSchema = z
  .object({
    employeeId: z.string().nullable(),
    cycleId: z.string().nullable(),
    kpiId: z.string().nullable(),
    title: z
      .string()
      .trim()
      .min(1, 'Enter the title')
      .max(200, 'Keep the title within 200 characters'),
    description: limited(4000),
    startDate: z.string(),
    dueDate: z.string().min(1, 'Choose the due date'),
    weight: numberText({ label: 'weight', min: 0, max: 100, required: true }),
    targetValue: numberText({ label: 'target', min: 0 }),
    status: z.enum(GOAL_STATUSES),
  })
  .superRefine((values, ctx) => {
    if (values.startDate && values.dueDate && values.dueDate < values.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: "The due date can't be before the start date",
      })
    }
  })
export type GoalFormValues = z.infer<typeof goalFormSchema>

export function goalToForm(goal: Goal | null, employeeId: string | null): GoalFormValues {
  return {
    employeeId: goal?.employeeId ?? employeeId,
    cycleId: goal?.cycleId ?? null,
    kpiId: goal?.kpiId ?? null,
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    startDate: goal?.startDate ?? '',
    dueDate: goal?.dueDate ?? '',
    weight: goal ? String(goal.weight) : '10',
    targetValue: toText(goal?.targetValue),
    status: goal?.status ?? 'not_started',
  }
}

/** The form as `GoalIn`; an edit keeps the progress and actual value check-ins set. */
export function goalFormToInput(values: GoalFormValues, goal: Goal | null): GoalInput {
  return {
    employeeId: values.employeeId,
    cycleId: values.cycleId,
    kpiId: values.kpiId,
    title: values.title.trim(),
    description: orNull(values.description),
    startDate: values.startDate || null,
    dueDate: values.dueDate,
    weight: toNumberOrNull(values.weight) ?? 0,
    targetValue: toNumberOrNull(values.targetValue),
    actualValue: goal?.actualValue ?? null,
    progress: goal ? goal.progress : null,
    status: goal ? values.status : null,
    rowVersion: goal?.rowVersion ?? null,
  }
}

/** Server names of the goal form's fields. */
export const GOAL_FIELD_OF = {
  appraisalCycleId: 'cycleId',
} as const

// --- check-in ---------------------------------------------------------------------------------

export const checkInFormSchema = z.object({
  progress: numberText({ label: 'progress', min: 0, max: 100, required: true }),
  actualValue: numberText({ label: 'actual value' }),
  /** '' lets the API set the status from the progress. */
  status: z.union([z.enum(GOAL_STATUSES), z.literal('')]),
  comments: limited(4000),
})
export type CheckInFormValues = z.infer<typeof checkInFormSchema>

export const checkInToForm = (goal: Goal): CheckInFormValues => ({
  progress: String(goal.progress),
  actualValue: toText(goal.actualValue),
  status: '',
  comments: '',
})

export const checkInFormToInput = (values: CheckInFormValues, goal: Goal): CheckInInput => ({
  progress: toNumberOrNull(values.progress),
  actualValue: toNumberOrNull(values.actualValue),
  status: values.status === '' ? null : values.status,
  comments: orNull(values.comments),
  rowVersion: goal.rowVersion,
})

// --- KPI --------------------------------------------------------------------------------------

export const kpiFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the KPI name')
    .max(200, 'Keep the name within 200 characters'),
  keyResultArea: limited(200),
  description: limited(4000),
  measureType: z.enum(MEASURE_TYPES),
  targetValue: numberText({ label: 'target', min: 0 }),
  unit: z.string().max(30, 'Keep the unit within 30 characters'),
  defaultWeight: numberText({ label: 'weight', min: 0, max: 100 }),
  departmentId: z.string().nullable(),
  jobTitleId: z.string().nullable(),
  isActive: z.boolean(),
})
export type KpiFormValues = z.infer<typeof kpiFormSchema>

export const kpiToForm = (kpi: Kpi | null): KpiFormValues => ({
  name: kpi?.name ?? '',
  keyResultArea: kpi?.keyResultArea ?? '',
  description: kpi?.description ?? '',
  measureType: kpi?.measureType ?? 'percentage',
  targetValue: toText(kpi?.targetValue),
  unit: kpi?.unit ?? '',
  defaultWeight: toText(kpi?.defaultWeight),
  departmentId: kpi?.departmentId ?? null,
  jobTitleId: kpi?.jobTitleId ?? null,
  isActive: kpi?.isActive ?? true,
})

export const kpiFormToInput = (values: KpiFormValues, kpi: Kpi | null): KpiInput => ({
  name: values.name.trim(),
  keyResultArea: orNull(values.keyResultArea),
  description: orNull(values.description),
  measureType: values.measureType,
  targetValue: toNumberOrNull(values.targetValue),
  unit: orNull(values.unit),
  defaultWeight: toNumberOrNull(values.defaultWeight),
  departmentId: values.departmentId,
  jobTitleId: values.jobTitleId,
  isActive: values.isActive,
  rowVersion: kpi?.rowVersion ?? null,
})

// --- cycle ------------------------------------------------------------------------------------

export const cycleFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the cycle name')
      .max(200, 'Keep the name within 200 characters'),
    formId: z.string({ error: 'Choose the appraisal form' }).nullable(),
    startDate: z.string().min(1, 'Choose the start date'),
    endDate: z.string().min(1, 'Choose the end date'),
    selfReviewDueDate: z.string(),
    managerReviewDueDate: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message })
    }
    if (!values.formId) issue('formId', 'Choose the appraisal form')
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      issue('endDate', "The end date can't be before the start date")
    }
    if (
      values.startDate &&
      values.selfReviewDueDate &&
      values.selfReviewDueDate < values.startDate
    ) {
      issue('selfReviewDueDate', "The self review can't be due before the cycle starts")
    }
    if (
      values.startDate &&
      values.managerReviewDueDate &&
      values.managerReviewDueDate < values.startDate
    ) {
      issue('managerReviewDueDate', "The manager review can't be due before the cycle starts")
    }
    if (
      values.selfReviewDueDate &&
      values.managerReviewDueDate &&
      values.managerReviewDueDate < values.selfReviewDueDate
    ) {
      issue('managerReviewDueDate', "The manager review can't be due before the self review")
    }
  })
export type CycleFormValues = z.infer<typeof cycleFormSchema>

export const cycleToForm = (cycle: Cycle | null): CycleFormValues => ({
  name: cycle?.name ?? '',
  formId: cycle?.formId ?? null,
  startDate: cycle?.startDate ?? '',
  endDate: cycle?.endDate ?? '',
  selfReviewDueDate: cycle?.selfReviewDueDate ?? '',
  managerReviewDueDate: cycle?.managerReviewDueDate ?? '',
})

export const cycleFormToInput = (
  values: CycleFormValues,
  cycle: Cycle | null,
  hasSelfReview: boolean,
): CycleInput => ({
  name: values.name.trim(),
  formId: values.formId ?? '',
  startDate: values.startDate,
  endDate: values.endDate,
  selfReviewDueDate: hasSelfReview ? values.selfReviewDueDate || null : null,
  managerReviewDueDate: values.managerReviewDueDate || null,
  rowVersion: cycle?.rowVersion ?? null,
})

export const CYCLE_FIELD_OF = { appraisalFormId: 'formId' } as const

// --- review -----------------------------------------------------------------------------------

export const reviewFormSchema = z.object({
  ratings: z.array(
    z.object({
      criterionId: z.string(),
      /** The chosen level's score as text, '' when not rated yet. */
      rating: z.string(),
      comment: limited(4000),
    }),
  ),
  comments: limited(8000),
  developmentNeeds: limited(8000),
})
export type ReviewFormValues = z.infer<typeof reviewFormSchema>

export function reviewToForm(
  appraisal: AppraisalDetail,
  part: 'self' | 'manager',
): ReviewFormValues {
  return {
    ratings: appraisal.ratings.map((row) => ({
      criterionId: row.criterionId,
      rating: toText(part === 'self' ? row.selfRating : row.managerRating),
      comment: (part === 'self' ? row.selfComment : row.managerComment) ?? '',
    })),
    comments: (part === 'self' ? appraisal.selfComments : appraisal.managerComments) ?? '',
    developmentNeeds: appraisal.developmentNeeds ?? '',
  }
}

export const reviewFormToInput = (
  values: ReviewFormValues,
  appraisal: AppraisalDetail,
  part: 'self' | 'manager',
  submit: boolean,
): ReviewInput => ({
  ratings: values.ratings.map((row) => ({
    criterionId: row.criterionId,
    rating: toNumberOrNull(row.rating),
    comment: orNull(row.comment),
  })),
  comments: orNull(values.comments),
  developmentNeeds: part === 'manager' ? orNull(values.developmentNeeds) : null,
  submit,
  rowVersion: appraisal.rowVersion,
})

/** Submitting needs a rating on every criterion; a draft may leave some out. */
export function missingRatings(values: ReviewFormValues): number[] {
  return values.ratings.flatMap((row, index) => (row.rating === '' ? [index] : []))
}

// --- participants ---------------------------------------------------------------------------

/** Add Participants: some people, a department, or both. */
export const participantsFormSchema = z
  .object({ employeeIds: z.array(z.string()), departmentId: z.string().nullable() })
  .refine((values) => values.employeeIds.length > 0 || values.departmentId !== null, {
    path: ['employeeIds'],
    message: 'Choose employees or a department to add',
  })

/**
 * The weights of a person's goals in one cycle, with the one being edited: above 100 the share
 * each goal has is not what its weight says, so the form warns (the API does not refuse it).
 */
export function cycleWeightTotal(
  others: readonly Pick<Goal, 'id' | 'weight' | 'status'>[],
  editingId: string | null,
  weight: string,
): number {
  const own = toNumberOrNull(weight) ?? 0
  return (
    own +
    others
      .filter((goal) => goal.id !== editingId && goal.status !== 'cancelled')
      .reduce((sum, goal) => sum + goal.weight, 0)
  )
}

// --- finalise ---------------------------------------------------------------------------------

export function finaliseFormSchema(min: number, max: number) {
  return z
    .object({
      finalScore: numberText({ label: 'final score', min, max, required: true, decimals: 2 }),
      outcome: z.enum(OUTCOMES),
      changeType: z.enum(CHANGE_TYPES),
      changeValue: z.string(),
      effectiveDate: z.string(),
      finalComments: limited(8000),
    })
    .superRefine((values, ctx) => {
      if (values.outcome !== 'increment') return
      const amount = toNumberOrNull(values.changeValue)
      if (amount === null || amount <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['changeValue'],
          message: 'Enter the increment (above 0)',
        })
      }
      if (!values.effectiveDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['effectiveDate'],
          message: 'Choose the effective date',
        })
      }
    })
}
export type FinaliseFormValues = z.infer<ReturnType<typeof finaliseFormSchema>>

/** The suggested final score: goals weight % of the goals score, the rest manager score. */
export function suggestedFinalScore(appraisal: AppraisalDetail): number | null {
  const { goalsScore, managerScore, goalsWeight } = appraisal
  if (managerScore === null) return goalsScore
  if (goalsScore === null || goalsWeight <= 0) return managerScore
  return (
    Math.round(((goalsWeight / 100) * goalsScore + (1 - goalsWeight / 100) * managerScore) * 100) /
    100
  )
}

export const finaliseToForm = (appraisal: AppraisalDetail): FinaliseFormValues => ({
  finalScore: toText(appraisal.finalScore ?? suggestedFinalScore(appraisal)),
  outcome: appraisal.outcome ?? 'no_change',
  changeType: 'percent',
  changeValue: '',
  effectiveDate: '',
  finalComments: appraisal.finalComments ?? '',
})

export const finaliseFormToInput = (
  values: FinaliseFormValues,
  appraisal: AppraisalDetail,
): FinaliseInput => {
  const amount = toNumberOrNull(values.changeValue)
  const withIncrement =
    (values.outcome === 'increment' || values.outcome === 'promotion') &&
    amount !== null &&
    amount > 0 &&
    values.effectiveDate !== ''
  return {
    finalScore: toNumberOrNull(values.finalScore),
    finalComments: orNull(values.finalComments),
    outcome: values.outcome,
    increment: withIncrement
      ? { changeType: values.changeType, changeValue: amount, effectiveDate: values.effectiveDate }
      : null,
    rowVersion: appraisal.rowVersion,
  }
}

export const FINALISE_FIELD_OF = {
  increment: 'changeValue',
  'increment.changeValue': 'changeValue',
  'increment.effectiveDate': 'effectiveDate',
  'increment.changeType': 'changeType',
} as const
