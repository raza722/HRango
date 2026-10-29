import { format } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  AppraisalDetailDto,
  AppraisalDto,
  AppraisalFormDto,
  CycleDto,
  GoalDetailDto,
  GoalDto,
  KpiDto,
  OverviewDto,
  ParticipantsOutDto,
  RatingScaleDto,
} from '@/features/performance/api/performance.dto'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { checkRowVersion } from '../settings/crud'
import { jobTitles } from '../settings/handlers'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import {
  appraisalForms,
  appraisals,
  cycles,
  goals,
  kpis,
  ratingScales,
  resetPerformanceTables,
} from './db'
import {
  goalsScore,
  type Level,
  ratingLabel,
  reviewScore,
  scaleRange,
  suggestedFinal,
} from './scoring'
import {
  type AppraisalRec,
  CALLER_ID,
  type CycleRec,
  DEPARTMENTS,
  type FormRec,
  type GoalRec,
  isWorking,
  type KpiRec,
  newRowVersion,
  personOf,
  reviewerOf,
  type ScaleRec,
} from './seed'

/*
 * The mock of `/api/performance/…`: overview, goals with check-ins, KPIs, review cycles with
 * participants / launch / close, appraisals with finalise, and the self and manager reviews.
 * It validates bodies as the API's schemas do (422 `{message, fieldErrors}`), answers 404 for
 * unknown records and 409 for a stale `rowVersion`, and keeps the status rules: no edits to a
 * closed cycle, launch only a draft with participants, close only an active cycle, reviews only
 * while the cycle runs and in order (self, then manager), finalise only once both are in, and
 * nothing changes on a locked goal. The signed-in person is Shelley Kannes (`em_shelley`).
 * Read-only here (no screen edits them): appraisal forms and rating scales. Not mocked:
 * increments (`/performance/increments…`).
 */

const base = (path: string) => apiPath(`/performance${path}`)
const today = () => format(new Date(), 'yyyy-MM-dd')
const now = () => new Date().toISOString()

const notFound = (what: string) => errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })

/** 422 with messages on fields (`title`, `ratings.0.rating` …). */
const invalid = (
  fieldErrors: Record<string, string>,
  message = 'Some fields need your attention.',
) => errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors })

/** 422 for a rule that is not about one field. */
const refused = (message: string) => errorResponse(422, message, { code: 'NOT_ALLOWED' })

/** Text as stored: empty or blank becomes null. */
const blank = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value.trim() === '' ? null : value

const forbidden = (message: string) => errorResponse(403, message, { code: 'FORBIDDEN' })

function fromIssues(issues: readonly z.core.$ZodIssue[]): Response {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = issue.path.map(String).join('.')
    if (field && !(field in fieldErrors)) fieldErrors[field] = issue.message
  }
  return invalid(fieldErrors)
}

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body ?? {})
}

// --- body schemas (the API's `…In` schemas) ---------------------------------------------------

/** Numbers come as numbers or numeric strings (`"12.5"`), as the API's `number|string`. */
const numberIn = (message = 'Enter a number.') =>
  z.union([
    z.number({ error: message }),
    z
      .string()
      .trim()
      .min(1, message)
      .refine((text) => Number.isFinite(Number(text.replace(/,/g, ''))), message)
      .transform((text) => Number(text.replace(/,/g, ''))),
  ])
const percent = (label: string) =>
  numberIn(`Enter the ${label} as a number.`).pipe(
    z
      .number()
      .min(0, `The ${label} can't be below 0.`)
      .max(100, `The ${label} can't be above 100.`),
  )
const idIn = z.union([z.number().int(), z.string().min(1)]).transform(String)
const dateIn = (message: string) =>
  z.string({ error: message }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as yyyy-mm-dd.')
const text = (max: number) => z.string().max(max, `Keep it within ${String(max)} characters.`)
const GOAL_STATUS = z.enum(['not_started', 'in_progress', 'completed', 'cancelled'], {
  error: 'Choose a status from the list.',
})

const goalIn = z.object({
  employeeId: idIn.nullish(),
  appraisalCycleId: idIn.nullish(),
  kpiId: idIn.nullish(),
  title: z
    .string({ error: 'Enter the title.' })
    .trim()
    .min(1, 'Enter the title.')
    .max(200, 'Keep the title within 200 characters.'),
  description: text(4000).nullish(),
  startDate: dateIn('Enter the start date.').nullish(),
  dueDate: dateIn('Choose the due date.'),
  weight: percent('weight').optional(),
  targetValue: numberIn('Enter the target as a number.')
    .refine((value) => value >= 0, "The target can't be below 0.")
    .nullish(),
  actualValue: numberIn('Enter the actual value as a number.').nullish(),
  progress: percent('progress').nullish(),
  status: GOAL_STATUS.nullish(),
  comments: text(4000).nullish(),
  rowVersion: z.string().nullish(),
})

const checkInIn = z.object({
  progress: percent('progress').nullish(),
  actualValue: numberIn('Enter the actual value as a number.').nullish(),
  status: GOAL_STATUS.nullish(),
  comments: text(4000).nullish(),
  rowVersion: z.string().optional(),
})

const MEASURE = z.enum(['percentage', 'number', 'amount', 'rating', 'yes_no'], {
  error: 'Choose a measure from the list.',
})

const kpiIn = z.object({
  name: z
    .string({ error: 'Enter the KPI name.' })
    .trim()
    .min(1, 'Enter the KPI name.')
    .max(200, 'Keep the name within 200 characters.'),
  keyResultArea: text(200).nullish(),
  description: text(4000).nullish(),
  measureType: MEASURE.default('percentage'),
  targetValue: numberIn('Enter the target as a number.')
    .refine((value) => value >= 0, "The target can't be below 0.")
    .nullish(),
  unit: z.string().max(30, 'Keep the unit within 30 characters.').nullish(),
  defaultWeight: percent('weight').nullish(),
  departmentId: idIn.nullish(),
  jobTitleId: idIn.nullish(),
  isActive: z.boolean().default(true),
  rowVersion: z.string().nullish(),
})

const cycleIn = z.object({
  name: z
    .string({ error: 'Enter the cycle name.' })
    .trim()
    .min(1, 'Enter the cycle name.')
    .max(200, 'Keep the name within 200 characters.'),
  appraisalFormId: idIn.refine(Boolean, 'Choose the appraisal form.'),
  startDate: dateIn('Choose the start date.'),
  endDate: dateIn('Choose the end date.'),
  selfReviewDueDate: dateIn('Enter the date.').nullish(),
  managerReviewDueDate: dateIn('Enter the date.').nullish(),
  rowVersion: z.string().nullish(),
})

const participantsIn = z.object({
  employeeIds: z.array(idIn).max(1000).optional(),
  departmentId: idIn.nullish(),
})

const rowVersionIn = z.object({ rowVersion: z.string().optional() })

const reviewIn = z.object({
  ratings: z
    .array(
      z.object({
        criterionId: idIn,
        rating: numberIn('Choose a rating.')
          .pipe(z.number().min(0).max(100, 'Choose a rating on the scale.'))
          .nullish(),
        comment: text(4000).nullish(),
      }),
    )
    .max(50)
    .optional(),
  comments: text(8000).nullish(),
  developmentNeeds: text(8000).nullish(),
  submit: z.boolean().default(false),
  rowVersion: z.string().optional(),
})

const finaliseIn = z.object({
  finalScore: numberIn('Enter the final score as a number.')
    .pipe(z.number().min(0).max(100))
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
      'Use at most 2 decimal places.',
    )
    .nullish(),
  finalComments: text(8000).nullish(),
  outcome: z
    .enum(['no_change', 'increment', 'promotion', 'improvement_plan'], {
      error: 'Choose an outcome from the list.',
    })
    .default('no_change'),
  increment: z
    .object({
      changeType: z.enum(['flat', 'percent'], { error: 'Choose flat or percentage.' }),
      changeValue: numberIn('Enter the increment as a number.').pipe(
        z.number().gt(0, 'The increment must be above 0.'),
      ),
      effectiveDate: dateIn('Choose the effective date.'),
    })
    .nullish(),
  letterFileId: idIn.nullish(),
  rowVersion: z.string().optional(),
})

// --- reading records -------------------------------------------------------------------------

const formOf = (cycle: CycleRec | undefined): FormRec | undefined =>
  cycle ? appraisalForms.find(cycle.appraisalFormId) : undefined

const levelsOf = (form: FormRec | undefined): Level[] =>
  (form ? ratingScales.find(form.ratingScaleId)?.levels : undefined) ?? []

const appraisalFor = (employeeId: string, cycleId: string) =>
  appraisals.all().find((item) => item.employeeId === employeeId && item.cycleId === cycleId)

function isLocked(goal: GoalRec): boolean {
  if (!goal.appraisalCycleId) return false
  const cycle = cycles.find(goal.appraisalCycleId)
  if (cycle?.status === 'closed') return true
  return appraisalFor(goal.employeeId, goal.appraisalCycleId)?.status === 'finalised'
}

const isOpenGoal = (goal: { status: string }) =>
  goal.status !== 'completed' && goal.status !== 'cancelled'
const isOverdue = (goal: GoalRec) => isOpenGoal(goal) && goal.dueDate < today()

function goalOut(goal: GoalRec): GoalDto {
  const person = personOf(goal.employeeId)
  return {
    id: goal.id,
    employeeId: goal.employeeId,
    employeeCode: person.employeeCode,
    employeeName: person.employeeName,
    departmentId: person.departmentId,
    departmentName: person.departmentName,
    appraisalCycleId: goal.appraisalCycleId,
    appraisalCycleName: goal.appraisalCycleId
      ? (cycles.find(goal.appraisalCycleId)?.name ?? null)
      : null,
    kpiId: goal.kpiId,
    kpiName: goal.kpiId ? (kpis.find(goal.kpiId)?.name ?? null) : null,
    title: goal.title,
    description: goal.description,
    startDate: goal.startDate,
    dueDate: goal.dueDate,
    weight: goal.weight,
    targetValue: goal.targetValue,
    actualValue: goal.actualValue,
    progress: goal.progress,
    status: goal.status,
    isOverdue: isOverdue(goal),
    isLocked: isLocked(goal),
    completedAt: goal.completedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    rowVersion: goal.rowVersion,
  }
}

const goalDetailOut = (goal: GoalRec): GoalDetailDto => ({
  ...goalOut(goal),
  checkIns: [...goal.checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
})

function kpiInUse(id: string): number {
  const inGoals = goals.all().filter((goal) => goal.kpiId === id).length
  const inForms = appraisalForms
    .all()
    .flatMap((form) => form.criteria)
    .filter((item) => item.kpiId === id).length
  return inGoals + inForms
}

function kpiOut(kpi: KpiRec): KpiDto {
  return {
    ...kpi,
    departmentName: kpi.departmentId ? (DEPARTMENTS.get(kpi.departmentId) ?? null) : null,
    jobTitleName: kpi.jobTitleId ? (jobTitles.find(kpi.jobTitleId)?.name ?? null) : null,
    inUse: kpiInUse(kpi.id),
  }
}

function cycleOut(cycle: CycleRec): CycleDto {
  const own = appraisals.all().filter((item) => item.cycleId === cycle.id)
  const count = (status: AppraisalRec['status']) =>
    own.filter((item) => item.status === status).length
  return {
    ...cycle,
    appraisalFormName: appraisalForms.find(cycle.appraisalFormId)?.name ?? '',
    participants: own.length,
    selfReview: count('self_review'),
    managerReview: count('manager_review'),
    reviewed: count('reviewed'),
    finalised: count('finalised'),
  }
}

function formOut(form: FormRec): AppraisalFormDto {
  const inUse = cycles.all().filter((cycle) => cycle.appraisalFormId === form.id).length
  return {
    ...form,
    ratingScaleName: ratingScales.find(form.ratingScaleId)?.name ?? '',
    criteria: form.criteria.map((item) => ({
      ...item,
      kpiName: item.kpiId ? (kpis.find(item.kpiId)?.name ?? null) : null,
    })),
    inUse,
    isLocked: inUse > 0,
  }
}

function scaleOut(scale: ScaleRec): RatingScaleDto {
  const { min, max } = scaleRange(scale.levels)
  return {
    ...scale,
    minScore: scale.levels.length ? min : null,
    maxScore: scale.levels.length ? max : null,
    inUse: appraisalForms.all().filter((form) => form.ratingScaleId === scale.id).length,
  }
}

/** The employee's goals in a cycle (what the goals score counts). */
const cycleGoals = (item: AppraisalRec) =>
  goals
    .all()
    .filter((goal) => goal.employeeId === item.employeeId && goal.appraisalCycleId === item.cycleId)

function scoresOf(item: AppraisalRec, form: FormRec | undefined) {
  const criteria = form?.criteria ?? []
  const rated = (key: 'selfRating' | 'managerRating') =>
    criteria.map((criterion) => ({
      weight: criterion.weight,
      rating: item.ratings.find((row) => row.criterionId === criterion.id)?.[key] ?? null,
    }))
  return {
    goalsScore: goalsScore(cycleGoals(item), levelsOf(form)),
    selfScore: reviewScore(rated('selfRating')),
    managerScore: reviewScore(rated('managerRating')),
  }
}

function appraisalOut(item: AppraisalRec): AppraisalDto {
  const cycle = cycles.find(item.cycleId)
  const form = formOf(cycle)
  const person = personOf(item.employeeId)
  return {
    id: item.id,
    appraisalCycleId: item.cycleId,
    appraisalCycleName: cycle?.name ?? '',
    cycleStatus: cycle?.status ?? 'draft',
    periodStart: cycle?.startDate ?? '',
    periodEnd: cycle?.endDate ?? '',
    selfReviewDueDate: cycle?.selfReviewDueDate ?? null,
    managerReviewDueDate: cycle?.managerReviewDueDate ?? null,
    appraisalFormId: form?.id ?? '',
    appraisalFormName: form?.name ?? '',
    hasSelfReview: form?.hasSelfReview ?? false,
    goalsWeight: form?.goalsWeight ?? 0,
    ratingScaleId: form?.ratingScaleId ?? '',
    ...person,
    reviewerEmployeeId: item.reviewerEmployeeId,
    reviewerName: item.reviewerEmployeeId
      ? (findEmployee(item.reviewerEmployeeId)?.name ?? null)
      : null,
    status: item.status,
    ...scoresOf(item, form),
    finalScore: item.finalScore,
    finalRatingLabel: item.finalRatingLabel,
    outcome: item.outcome,
    selfSubmittedAt: item.selfSubmittedAt,
    managerSubmittedAt: item.managerSubmittedAt,
    finalisedAt: item.finalisedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    rowVersion: item.rowVersion,
  }
}

function appraisalDetailOut(item: AppraisalRec): AppraisalDetailDto {
  const form = formOf(cycles.find(item.cycleId))
  return {
    ...appraisalOut(item),
    selfComments: item.selfComments,
    managerComments: item.managerComments,
    finalComments: item.finalComments,
    developmentNeeds: item.developmentNeeds,
    letterFile: null,
    ratings: (form?.criteria ?? []).map((criterion) => {
      const row = item.ratings.find((rating) => rating.criterionId === criterion.id)
      return {
        criterionId: criterion.id,
        kpiId: criterion.kpiId,
        kpiName: criterion.kpiId ? (kpis.find(criterion.kpiId)?.name ?? null) : null,
        name: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        sortOrder: criterion.sortOrder,
        selfRating: row?.selfRating ?? null,
        selfComment: row?.selfComment ?? null,
        managerRating: row?.managerRating ?? null,
        managerComment: row?.managerComment ?? null,
      }
    }),
    goals: cycleGoals(item)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        dueDate: goal.dueDate,
        weight: goal.weight,
        progress: goal.progress,
        status: goal.status,
      })),
    scale: levelsOf(form),
    increment: item.increment,
  }
}

// --- query helpers ----------------------------------------------------------------------------

type Tab = 'my' | 'team' | 'all'

function readTab(url: URL, fallback: Tab): Tab | Response {
  const tab = url.searchParams.get('tab') ?? fallback
  return tab === 'my' || tab === 'team' || tab === 'all'
    ? tab
    : invalid({ tab: 'Choose my, team or all.' })
}

const inTab = (tab: Tab, employeeId: string, reviewerId: string | null) =>
  tab === 'all' ||
  (tab === 'my' && employeeId === CALLER_ID) ||
  (tab === 'team' && reviewerId === CALLER_ID)

const matches = (q: string, ...values: (string | null | undefined)[]) =>
  !q || values.some((value) => value?.toLowerCase().includes(q))

const bool = (value: string | null) => (value === null ? null : value === 'true')

function appraisalRows(url: URL, tab: Tab, reviews: boolean): AppraisalRec[] {
  const cycleId = url.searchParams.get('cycleId')
  const status = url.searchParams.get('status')
  const employeeId = url.searchParams.get('employeeId')
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const waiting = (item: AppraisalRec) =>
    (item.status === 'self_review' && item.employeeId === CALLER_ID) ||
    (item.status === 'manager_review' && item.reviewerEmployeeId === CALLER_ID)
  return appraisals
    .all()
    .filter((item) => !reviews || item.status !== 'draft')
    .filter((item) => inTab(tab, item.employeeId, item.reviewerEmployeeId))
    .filter((item) => !cycleId || item.cycleId === cycleId)
    .filter((item) => !status || item.status === status)
    .filter((item) => !employeeId || item.employeeId === employeeId)
    .filter((item) => {
      const person = personOf(item.employeeId)
      return matches(q, person.employeeName, person.employeeCode, cycles.find(item.cycleId)?.name)
    })
    .sort((a, b) => {
      if (reviews && waiting(a) !== waiting(b)) return waiting(a) ? -1 : 1
      const start = (item: AppraisalRec) => cycles.find(item.cycleId)?.startDate ?? ''
      return (
        start(b).localeCompare(start(a)) ||
        personOf(a.employeeId).employeeName.localeCompare(personOf(b.employeeId).employeeName)
      )
    })
}

const page = <T>(rows: readonly T[], url: URL) => {
  const { page: number, pageSize } = readPageParams(url)
  return paginate(rows, number, pageSize)
}

// --- rules ------------------------------------------------------------------------------------

type GoalBody = z.infer<typeof goalIn>

/** References and dates of a goal body; returns the error, or the resolved employee. */
function checkGoal(body: GoalBody, current: GoalRec | undefined): Response | string {
  const employeeId = body.employeeId ?? current?.employeeId ?? CALLER_ID
  if (!findEmployee(employeeId)) return invalid({ employeeId: 'Choose an employee from the list.' })
  if (body.appraisalCycleId) {
    const cycle = cycles.find(body.appraisalCycleId)
    if (!cycle) return invalid({ appraisalCycleId: 'Choose a review cycle from the list.' })
    if (cycle.status === 'closed' && cycle.id !== current?.appraisalCycleId) {
      return invalid({ appraisalCycleId: 'This review cycle is closed.' })
    }
  }
  if (body.kpiId) {
    const kpi = kpis.find(body.kpiId)
    if (!kpi) return invalid({ kpiId: 'Choose a KPI from the library.' })
    if (!kpi.isActive && kpi.id !== current?.kpiId) {
      return invalid({ kpiId: 'This KPI is inactive.' })
    }
  }
  if (body.startDate && body.startDate > body.dueDate) {
    return invalid({ dueDate: 'The due date can’t be before the start date.' })
  }
  return employeeId
}

/** The status a progress implies when none is given. */
const statusFor = (progress: number): GoalRec['status'] =>
  progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'

function checkKpi(body: z.infer<typeof kpiIn>, currentId: string | undefined): Response | null {
  const name = body.name.toLowerCase()
  if (kpis.all().some((item) => item.id !== currentId && item.name.toLowerCase() === name)) {
    return invalid({ name: 'A KPI with this name already exists.' })
  }
  if (body.departmentId && !DEPARTMENTS.has(body.departmentId)) {
    return invalid({ departmentId: 'Choose a department from the list.' })
  }
  if (body.jobTitleId && !jobTitles.find(body.jobTitleId)) {
    return invalid({ jobTitleId: 'Choose a job title from the list.' })
  }
  return null
}

function checkCycle(body: z.infer<typeof cycleIn>, current: CycleRec | undefined) {
  const name = body.name.toLowerCase()
  if (cycles.all().some((item) => item.id !== current?.id && item.name.toLowerCase() === name)) {
    return invalid({ name: 'A review cycle with this name already exists.' })
  }
  const form = appraisalForms.find(body.appraisalFormId)
  if (!form || (!form.isActive && form.id !== current?.appraisalFormId)) {
    return invalid({ appraisalFormId: 'Choose an active appraisal form.' })
  }
  if (current && current.status !== 'draft' && form.id !== current.appraisalFormId) {
    return invalid({ appraisalFormId: 'The form can’t change once the cycle is launched.' })
  }
  if (body.endDate < body.startDate) {
    return invalid({ endDate: 'The end date can’t be before the start date.' })
  }
  const self = form.hasSelfReview ? (body.selfReviewDueDate ?? null) : null
  const manager = body.managerReviewDueDate ?? null
  if (self && self < body.startDate) {
    return invalid({ selfReviewDueDate: 'The self review can’t be due before the cycle starts.' })
  }
  if (manager && manager < body.startDate) {
    return invalid({
      managerReviewDueDate: 'The manager review can’t be due before the cycle starts.',
    })
  }
  if (self && manager && manager < self) {
    return invalid({
      managerReviewDueDate: 'The manager review can’t be due before the self review.',
    })
  }
  return { form, selfReviewDueDate: self, managerReviewDueDate: manager }
}

/** The status a new or launched appraisal starts at. */
const firstStage = (form: FormRec | undefined): AppraisalRec['status'] =>
  form?.hasSelfReview === false ? 'manager_review' : 'self_review'

function newAppraisal(cycle: CycleRec, employeeId: string): AppraisalRec {
  return {
    id: createId('pa'),
    cycleId: cycle.id,
    employeeId,
    reviewerEmployeeId: reviewerOf(employeeId),
    status: cycle.status === 'draft' ? 'draft' : firstStage(formOf(cycle)),
    ratings: [],
    selfComments: null,
    managerComments: null,
    finalComments: null,
    developmentNeeds: null,
    finalScore: null,
    finalRatingLabel: null,
    outcome: null,
    selfSubmittedAt: null,
    managerSubmittedAt: null,
    finalisedAt: null,
    increment: null,
    createdAt: now(),
    updatedAt: null,
    rowVersion: newRowVersion(),
  }
}

// --- handlers ---------------------------------------------------------------------------------

/** Wraps a handler with the latency and the sign-in check every endpoint has. */
function guarded(
  run: (args: { request: Request; id: string; url: URL }) => Response | Promise<Response>,
) {
  return async ({
    request,
    params,
  }: {
    request: Request
    params: Record<string, string | readonly string[] | undefined>
  }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const id = params.id
    return run({ request, id: typeof id === 'string' ? id : '', url: new URL(request.url) })
  }
}

export const performanceHandlers: HttpHandler[] = [
  // --- overview ------------------------------------------------------------------------------
  http.get(
    base('/overview'),
    guarded(({ url }) => {
      const employeeId = blank(url.searchParams.get('employeeId')) ?? CALLER_ID
      if (!findEmployee(employeeId)) return notFound('Employee')
      const person = personOf(employeeId)
      const own = goals.all().filter((goal) => goal.employeeId === employeeId)
      const counted = own.filter((goal) => goal.status !== 'cancelled')
      const weight = counted.reduce((sum, goal) => sum + goal.weight, 0)
      const count = (status: GoalRec['status']) =>
        own.filter((goal) => goal.status === status).length
      const body: OverviewDto = {
        employeeId,
        employeeCode: person.employeeCode,
        employeeName: person.employeeName,
        departmentName: person.departmentName,
        jobTitleName: person.jobTitleName,
        goals: {
          total: own.length,
          notStarted: count('not_started'),
          inProgress: count('in_progress'),
          completed: count('completed'),
          cancelled: count('cancelled'),
          overdue: own.filter(isOverdue).length,
          weightedProgress:
            counted.length === 0
              ? null
              : Math.round(
                  weight > 0
                    ? counted.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) / weight
                    : counted.reduce((sum, goal) => sum + goal.progress, 0) / counted.length,
                ),
        },
        upcomingGoals: own
          .filter(isOpenGoal)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .slice(0, 5)
          .map((goal) => ({
            id: goal.id,
            title: goal.title,
            dueDate: goal.dueDate,
            progress: goal.progress,
            status: goal.status,
            isOverdue: isOverdue(goal),
          })),
        appraisals: appraisals
          .all()
          .filter((item) => item.employeeId === employeeId)
          .map((item) => {
            const cycle = cycles.find(item.cycleId)
            return {
              id: item.id,
              appraisalCycleId: item.cycleId,
              appraisalCycleName: cycle?.name ?? '',
              periodStart: cycle?.startDate ?? '',
              periodEnd: cycle?.endDate ?? '',
              status: item.status,
              selfReviewDueDate: cycle?.selfReviewDueDate ?? null,
              managerReviewDueDate: cycle?.managerReviewDueDate ?? null,
              finalScore: item.finalScore,
              finalRatingLabel: item.finalRatingLabel,
              outcome: item.outcome,
              finalisedAt: item.finalisedAt,
            }
          })
          .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
      }
      return HttpResponse.json<ApiItem<OverviewDto>>({ data: body })
    }),
  ),

  // --- goals ---------------------------------------------------------------------------------
  http.get(
    base('/goals'),
    guarded(({ url }) => {
      const tab = readTab(url, 'all')
      if (tab instanceof Response) return tab
      const status = url.searchParams.get('status')
      const cycleId = url.searchParams.get('cycleId')
      const employeeId = url.searchParams.get('employeeId')
      const overdue = bool(url.searchParams.get('overdue'))
      const dueFrom = url.searchParams.get('dueFrom')
      const dueTo = url.searchParams.get('dueTo')
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const rows = goals
        .all()
        .filter((goal) => inTab(tab, goal.employeeId, reviewerOf(goal.employeeId)))
        .filter((goal) => !status || goal.status === status)
        .filter((goal) => !cycleId || goal.appraisalCycleId === cycleId)
        .filter((goal) => !employeeId || goal.employeeId === employeeId)
        .filter((goal) => overdue === null || isOverdue(goal) === overdue)
        .filter(
          (goal) => (!dueFrom || goal.dueDate >= dueFrom) && (!dueTo || goal.dueDate <= dueTo),
        )
        .map(goalOut)
        .filter((goal) => matches(q, goal.title, goal.description, goal.employeeName, goal.kpiName))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title))
      return HttpResponse.json<Paginated<GoalDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/goals/:id'),
    guarded(({ id }) => {
      const goal = goals.find(id)
      return goal
        ? HttpResponse.json<ApiItem<GoalDetailDto>>({ data: goalDetailOut(goal) })
        : notFound('Goal')
    }),
  ),

  http.post(
    base('/goals'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, goalIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const employeeId = checkGoal(body, undefined)
      if (employeeId instanceof Response) return employeeId
      const progress = body.progress ?? 0
      const status = body.status ?? statusFor(progress)
      const goal: GoalRec = {
        id: createId('pg'),
        employeeId,
        appraisalCycleId: body.appraisalCycleId ?? null,
        kpiId: body.kpiId ?? null,
        title: body.title,
        description: blank(body.description),
        startDate: body.startDate ?? null,
        dueDate: body.dueDate,
        weight: body.weight ?? 1,
        targetValue: body.targetValue ?? null,
        actualValue: body.actualValue ?? null,
        progress,
        status,
        completedAt: status === 'completed' ? now() : null,
        checkIns: [],
        createdAt: now(),
        updatedAt: null,
        rowVersion: newRowVersion(),
      }
      goals.insert(goal)
      return HttpResponse.json<ApiItem<GoalDetailDto>>(
        { data: goalDetailOut(goal) },
        { status: 201 },
      )
    }),
  ),

  http.put(
    base('/goals/:id'),
    guarded(async ({ request, id }) => {
      const current = goals.find(id)
      if (!current) return notFound('Goal')
      const parsed = await readBody(request, goalIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const stale = checkRowVersion(body.rowVersion, current, 'goal')
      if (stale) return stale
      if (isLocked(current)) return refused('This goal is locked: its review cycle is closed.')
      const employeeId = checkGoal(body, current)
      if (employeeId instanceof Response) return employeeId
      const progress = body.progress ?? current.progress
      const status = body.status ?? (body.progress == null ? current.status : statusFor(progress))
      const actualValue = body.actualValue === undefined ? current.actualValue : body.actualValue
      const changed =
        progress !== current.progress ||
        status !== current.status ||
        actualValue !== current.actualValue
      const next: GoalRec = {
        ...current,
        employeeId,
        appraisalCycleId: body.appraisalCycleId ?? null,
        kpiId: body.kpiId ?? null,
        title: body.title,
        description: blank(body.description),
        startDate: body.startDate ?? null,
        dueDate: body.dueDate,
        weight: body.weight ?? current.weight,
        targetValue: body.targetValue ?? null,
        actualValue,
        progress,
        status,
        completedAt: status === 'completed' ? (current.completedAt ?? now()) : null,
        checkIns: changed
          ? [
              {
                id: createId('ci'),
                progress,
                actualValue,
                status,
                comments: blank(body.comments),
                createdAt: now(),
                createdByName: findEmployee(CALLER_ID)?.name ?? null,
              },
              ...current.checkIns,
            ]
          : current.checkIns,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      goals.update(current.id, next)
      return HttpResponse.json<ApiItem<GoalDetailDto>>({ data: goalDetailOut(next) })
    }),
  ),

  http.delete(
    base('/goals/:id'),
    guarded(({ id, url }) => {
      const current = goals.find(id)
      if (!current) return notFound('Goal')
      const stale = checkRowVersion(url.searchParams.get('rowVersion'), current, 'goal')
      if (stale) return stale
      if (isLocked(current)) return refused('This goal is locked: its review cycle is closed.')
      goals.remove(current.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    base('/goals/:id/check-ins'),
    guarded(async ({ request, id }) => {
      const current = goals.find(id)
      if (!current) return notFound('Goal')
      const parsed = await readBody(request, checkInIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const stale = checkRowVersion(body.rowVersion, current, 'goal')
      if (stale) return stale
      if (isLocked(current)) return refused('This goal is locked: its review cycle is closed.')
      if (body.progress == null && body.actualValue == null && !body.status && !body.comments) {
        return invalid({ progress: 'Enter the progress, the actual value or a comment.' })
      }
      // Without a progress, the actual value against the target gives it.
      let progress = body.progress ?? current.progress
      if (body.progress == null && body.actualValue != null && current.targetValue) {
        progress = Math.max(
          0,
          Math.min(100, Math.round((body.actualValue / current.targetValue) * 100)),
        )
      }
      const status = body.status ?? statusFor(progress)
      const actualValue = body.actualValue ?? current.actualValue
      const next: GoalRec = {
        ...current,
        progress,
        actualValue,
        status,
        completedAt: status === 'completed' ? (current.completedAt ?? now()) : null,
        checkIns: [
          {
            id: createId('ci'),
            progress,
            actualValue,
            status,
            comments: blank(body.comments),
            createdAt: now(),
            createdByName: findEmployee(CALLER_ID)?.name ?? null,
          },
          ...current.checkIns,
        ],
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      goals.update(current.id, next)
      return HttpResponse.json<ApiItem<GoalDetailDto>>({ data: goalDetailOut(next) })
    }),
  ),

  // --- KPIs ----------------------------------------------------------------------------------
  http.get(
    base('/kpis'),
    guarded(({ url }) => {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const area = (url.searchParams.get('keyResultArea') ?? '').trim().toLowerCase()
      const departmentId = url.searchParams.get('departmentId')
      const active = bool(url.searchParams.get('isActive'))
      const rows = kpis
        .all()
        .filter((kpi) => matches(q, kpi.name, kpi.description, kpi.keyResultArea))
        .filter((kpi) => !area || (kpi.keyResultArea ?? '').toLowerCase() === area)
        .filter((kpi) => !departmentId || kpi.departmentId === departmentId)
        .filter((kpi) => active === null || kpi.isActive === active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(kpiOut)
      return HttpResponse.json<Paginated<KpiDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/kpis/:id'),
    guarded(({ id }) => {
      const kpi = kpis.find(id)
      return kpi ? HttpResponse.json<ApiItem<KpiDto>>({ data: kpiOut(kpi) }) : notFound('KPI')
    }),
  ),

  http.post(
    base('/kpis'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, kpiIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const refusedBody = checkKpi(body, undefined)
      if (refusedBody) return refusedBody
      const kpi: KpiRec = {
        id: createId('pk'),
        name: body.name,
        keyResultArea: blank(body.keyResultArea),
        description: blank(body.description),
        measureType: body.measureType,
        targetValue: body.targetValue ?? null,
        unit: blank(body.unit),
        defaultWeight: body.defaultWeight ?? null,
        departmentId: body.departmentId ?? null,
        jobTitleId: body.jobTitleId ?? null,
        isActive: body.isActive,
        createdAt: now(),
        updatedAt: null,
        rowVersion: newRowVersion(),
      }
      kpis.insert(kpi)
      return HttpResponse.json<ApiItem<KpiDto>>({ data: kpiOut(kpi) }, { status: 201 })
    }),
  ),

  http.put(
    base('/kpis/:id'),
    guarded(async ({ request, id }) => {
      const current = kpis.find(id)
      if (!current) return notFound('KPI')
      const parsed = await readBody(request, kpiIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const stale = checkRowVersion(body.rowVersion, current, 'KPI')
      if (stale) return stale
      const refusedBody = checkKpi(body, current.id)
      if (refusedBody) return refusedBody
      const next: KpiRec = {
        ...current,
        name: body.name,
        keyResultArea: blank(body.keyResultArea),
        description: blank(body.description),
        measureType: body.measureType,
        targetValue: body.targetValue ?? null,
        unit: blank(body.unit),
        defaultWeight: body.defaultWeight ?? null,
        departmentId: body.departmentId ?? null,
        jobTitleId: body.jobTitleId ?? null,
        isActive: body.isActive,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      kpis.update(current.id, next)
      return HttpResponse.json<ApiItem<KpiDto>>({ data: kpiOut(next) })
    }),
  ),

  http.delete(
    base('/kpis/:id'),
    guarded(({ id, url }) => {
      const current = kpis.find(id)
      if (!current) return notFound('KPI')
      const stale = checkRowVersion(url.searchParams.get('rowVersion'), current, 'KPI')
      if (stale) return stale
      const used = kpiInUse(current.id)
      if (used > 0) {
        return errorResponse(
          409,
          `${current.name} is used by ${String(used)} goal${used === 1 ? '' : 's'} or criteria. Make it inactive instead.`,
          { code: 'IN_USE' },
        )
      }
      kpis.remove(current.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // --- appraisal forms and rating scales (read-only) -------------------------------------------
  http.get(
    base('/forms'),
    guarded(({ url }) => {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const active = bool(url.searchParams.get('isActive'))
      const rows = appraisalForms
        .all()
        .filter((form) => matches(q, form.name, form.description))
        .filter((form) => active === null || form.isActive === active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(formOut)
      return HttpResponse.json<Paginated<AppraisalFormDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/forms/:id'),
    guarded(({ id }) => {
      const form = appraisalForms.find(id)
      return form
        ? HttpResponse.json<ApiItem<AppraisalFormDto>>({ data: formOut(form) })
        : notFound('Appraisal form')
    }),
  ),

  http.get(
    base('/rating-scales'),
    guarded(({ url }) => {
      const rows = ratingScales
        .all()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(scaleOut)
      return HttpResponse.json<Paginated<RatingScaleDto>>(page(rows, url))
    }),
  ),

  // --- cycles --------------------------------------------------------------------------------
  http.get(
    base('/cycles'),
    guarded(({ url }) => {
      const status = url.searchParams.get('status')
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const rows = cycles
        .all()
        .filter((cycle) => !status || cycle.status === status)
        .filter((cycle) => matches(q, cycle.name))
        .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name))
        .map(cycleOut)
      return HttpResponse.json<Paginated<CycleDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/cycles/:id'),
    guarded(({ id }) => {
      const cycle = cycles.find(id)
      return cycle
        ? HttpResponse.json<ApiItem<CycleDto>>({ data: cycleOut(cycle) })
        : notFound('Review cycle')
    }),
  ),

  http.post(
    base('/cycles'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, cycleIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const checked = checkCycle(body, undefined)
      if (checked instanceof Response) return checked
      const cycle: CycleRec = {
        id: createId('pc'),
        name: body.name,
        appraisalFormId: checked.form.id,
        startDate: body.startDate,
        endDate: body.endDate,
        selfReviewDueDate: checked.selfReviewDueDate,
        managerReviewDueDate: checked.managerReviewDueDate,
        status: 'draft',
        launchedAt: null,
        closedAt: null,
        createdAt: now(),
        updatedAt: null,
        rowVersion: newRowVersion(),
      }
      cycles.insert(cycle)
      return HttpResponse.json<ApiItem<CycleDto>>({ data: cycleOut(cycle) }, { status: 201 })
    }),
  ),

  http.put(
    base('/cycles/:id'),
    guarded(async ({ request, id }) => {
      const current = cycles.find(id)
      if (!current) return notFound('Review cycle')
      const parsed = await readBody(request, cycleIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const stale = checkRowVersion(body.rowVersion, current, 'review cycle')
      if (stale) return stale
      if (current.status === 'closed') return refused('A closed review cycle can’t be changed.')
      const checked = checkCycle(body, current)
      if (checked instanceof Response) return checked
      const next: CycleRec = {
        ...current,
        name: body.name,
        appraisalFormId: checked.form.id,
        startDate: body.startDate,
        endDate: body.endDate,
        selfReviewDueDate: checked.selfReviewDueDate,
        managerReviewDueDate: checked.managerReviewDueDate,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      cycles.update(current.id, next)
      return HttpResponse.json<ApiItem<CycleDto>>({ data: cycleOut(next) })
    }),
  ),

  http.delete(
    base('/cycles/:id'),
    guarded(({ id, url }) => {
      const current = cycles.find(id)
      if (!current) return notFound('Review cycle')
      const stale = checkRowVersion(url.searchParams.get('rowVersion'), current, 'review cycle')
      if (stale) return stale
      if (current.status !== 'draft') {
        return refused('Only a draft review cycle can be deleted; close a launched one instead.')
      }
      for (const item of appraisals.all().filter((row) => row.cycleId === current.id)) {
        appraisals.remove(item.id)
      }
      for (const goal of goals.all().filter((row) => row.appraisalCycleId === current.id)) {
        goals.update(goal.id, { ...goal, appraisalCycleId: null, rowVersion: newRowVersion() })
      }
      cycles.remove(current.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    base('/cycles/:id/participants'),
    guarded(async ({ request, id }) => {
      const cycle = cycles.find(id)
      if (!cycle) return notFound('Review cycle')
      const parsed = await readBody(request, participantsIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      if (cycle.status === 'closed') return refused('People can’t join a closed review cycle.')
      const { employeeIds = [], departmentId } = parsed.data
      if (employeeIds.length === 0 && !departmentId) {
        return invalid({ employeeIds: 'Choose people or a department.' })
      }
      const unknown = employeeIds.find((id) => !findEmployee(id))
      if (unknown) return invalid({ employeeIds: `Unknown employee: ${unknown}.` })
      const gone = employeeIds.find((id) => !isWorking(id))
      if (gone) {
        return invalid({
          employeeIds: `${findEmployee(gone)?.name ?? gone} no longer works here.`,
        })
      }
      let department: string[] = []
      if (departmentId) {
        const name = DEPARTMENTS.get(departmentId)
        if (!name) return invalid({ departmentId: 'Choose a department from the list.' })
        department = DIRECTORY.filter(
          (person) => person.department === name && isWorking(person.id),
        ).map((person) => person.id)
      }
      let added = 0
      for (const employeeId of new Set([...employeeIds, ...department])) {
        if (appraisalFor(employeeId, cycle.id)) continue
        appraisals.insert(newAppraisal(cycle, employeeId))
        added += 1
      }
      return HttpResponse.json<ApiItem<ParticipantsOutDto>>({
        data: { cycle: cycleOut(cycle), added },
      })
    }),
  ),

  http.post(
    base('/cycles/:id/launch'),
    guarded(async ({ request, id }) => {
      const cycle = cycles.find(id)
      if (!cycle) return notFound('Review cycle')
      const parsed = await readBody(request, rowVersionIn)
      const stale = checkRowVersion(parsed.data?.rowVersion, cycle, 'review cycle')
      if (stale) return stale
      if (cycle.status !== 'draft') return refused('Only a draft review cycle can be launched.')
      const own = appraisals.all().filter((item) => item.cycleId === cycle.id)
      if (own.length === 0) return refused('Add participants before launching the cycle.')
      const stage = firstStage(formOf(cycle))
      for (const item of own) {
        appraisals.update(item.id, {
          ...item,
          status: stage,
          updatedAt: now(),
          rowVersion: newRowVersion(),
        })
      }
      const next: CycleRec = {
        ...cycle,
        status: 'active',
        launchedAt: now(),
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      cycles.update(cycle.id, next)
      return HttpResponse.json<ApiItem<CycleDto>>({ data: cycleOut(next) })
    }),
  ),

  http.post(
    base('/cycles/:id/close'),
    guarded(async ({ request, id }) => {
      const cycle = cycles.find(id)
      if (!cycle) return notFound('Review cycle')
      const parsed = await readBody(request, rowVersionIn)
      const stale = checkRowVersion(parsed.data?.rowVersion, cycle, 'review cycle')
      if (stale) return stale
      if (cycle.status !== 'active') return refused('Only an active review cycle can be closed.')
      const next: CycleRec = {
        ...cycle,
        status: 'closed',
        closedAt: now(),
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      cycles.update(cycle.id, next)
      return HttpResponse.json<ApiItem<CycleDto>>({ data: cycleOut(next) })
    }),
  ),

  // --- appraisals ----------------------------------------------------------------------------
  http.get(
    base('/appraisals'),
    guarded(({ url }) => {
      const tab = readTab(url, 'all')
      if (tab instanceof Response) return tab
      const rows = appraisalRows(url, tab, false).map(appraisalOut)
      return HttpResponse.json<Paginated<AppraisalDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/appraisals/:id'),
    guarded(({ id }) => {
      const item = appraisals.find(id)
      return item
        ? HttpResponse.json<ApiItem<AppraisalDetailDto>>({ data: appraisalDetailOut(item) })
        : notFound('Appraisal')
    }),
  ),

  http.delete(
    base('/appraisals/:id'),
    guarded(({ id, url }) => {
      const item = appraisals.find(id)
      if (!item) return notFound('Appraisal')
      const stale = checkRowVersion(url.searchParams.get('rowVersion'), item, 'appraisal')
      if (stale) return stale
      if (cycles.find(item.cycleId)?.status === 'closed') {
        return refused('The review cycle is closed; its appraisals stay.')
      }
      if (item.status === 'finalised') return refused('A finalised appraisal can’t be removed.')
      appraisals.remove(item.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    base('/appraisals/:id/finalise'),
    guarded(async ({ request, id }) => {
      const item = appraisals.find(id)
      if (!item) return notFound('Appraisal')
      const parsed = await readBody(request, finaliseIn)
      if (!parsed.success) return fromIssues(parsed.error.issues)
      const body = parsed.data
      const stale = checkRowVersion(body.rowVersion, item, 'appraisal')
      if (stale) return stale
      const cycle = cycles.find(item.cycleId)
      const form = formOf(cycle)
      if (cycle?.status !== 'active') return refused('The review cycle is not running.')
      if (item.status === 'finalised') return refused('This appraisal is already finalised.')
      if (item.status !== 'reviewed') {
        return refused(
          form?.hasSelfReview === false
            ? 'Finalise once the manager review is submitted.'
            : 'Finalise once both the self review and the manager review are submitted.',
        )
      }
      const levels = levelsOf(form)
      const { min, max } = scaleRange(levels)
      if (body.finalScore != null && (body.finalScore < min || body.finalScore > max)) {
        return invalid({
          finalScore: `The final score must be between ${String(min)} and ${String(max)}.`,
        })
      }
      if (body.outcome === 'increment' && !body.increment) {
        return invalid({ increment: 'Enter the increment for this outcome.' })
      }
      const scores = scoresOf(item, form)
      const finalScore =
        body.finalScore ??
        suggestedFinal(form?.goalsWeight ?? 0, scores.goalsScore, scores.managerScore)
      const next: AppraisalRec = {
        ...item,
        status: 'finalised',
        finalScore,
        finalRatingLabel: ratingLabel(levels, finalScore),
        finalComments: blank(body.finalComments),
        outcome: body.outcome,
        finalisedAt: now(),
        increment: body.increment
          ? { id: createId('pi'), ...body.increment, status: 'proposed' }
          : null,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      appraisals.update(item.id, next)
      return HttpResponse.json<ApiItem<AppraisalDetailDto>>({ data: appraisalDetailOut(next) })
    }),
  ),

  // --- reviews -------------------------------------------------------------------------------
  http.get(
    base('/reviews'),
    guarded(({ url }) => {
      const tab = readTab(url, 'my')
      if (tab instanceof Response) return tab
      const rows = appraisalRows(url, tab, true).map(appraisalOut)
      return HttpResponse.json<Paginated<AppraisalDto>>(page(rows, url))
    }),
  ),

  http.get(
    base('/reviews/:id'),
    guarded(({ id }) => {
      const item = appraisals.find(id)
      return item && item.status !== 'draft'
        ? HttpResponse.json<ApiItem<AppraisalDetailDto>>({ data: appraisalDetailOut(item) })
        : notFound('Review')
    }),
  ),

  ...(['self', 'manager'] as const).map((part) =>
    http.put(
      base(`/reviews/:id/${part}`),
      guarded(async ({ request, id }) => {
        const item = appraisals.find(id)
        if (!item) return notFound('Review')
        const parsed = await readBody(request, reviewIn)
        if (!parsed.success) return fromIssues(parsed.error.issues)
        const body = parsed.data
        const stale = checkRowVersion(body.rowVersion, item, 'review')
        if (stale) return stale
        const cycle = cycles.find(item.cycleId)
        const form = formOf(cycle)
        if (cycle?.status !== 'active') return refused('The review cycle is not open for reviews.')
        if (part === 'self') {
          if (item.employeeId !== CALLER_ID) {
            return forbidden('Only the employee can write their self review.')
          }
          if (form?.hasSelfReview === false) return refused('This appraisal has no self review.')
          if (item.status !== 'self_review') {
            return refused('The self review has already been submitted.')
          }
        } else {
          if (item.reviewerEmployeeId !== CALLER_ID) {
            return forbidden('Only the reviewer can write the manager review.')
          }
          if (item.status === 'self_review') {
            return refused('The self review has not been submitted yet.')
          }
          if (item.status !== 'manager_review') {
            return refused('The manager review has already been submitted.')
          }
        }
        const criteria = form?.criteria ?? []
        const levels = levelsOf(form)
        const { min, max } = scaleRange(levels)
        const sent = body.ratings ?? []
        const errors: Record<string, string> = {}
        sent.forEach((row, index) => {
          if (!criteria.some((criterion) => criterion.id === row.criterionId)) {
            errors[`ratings.${String(index)}.criterionId`] = 'This criterion is not on the form.'
          } else if (row.rating != null && (row.rating < min || row.rating > max)) {
            errors[`ratings.${String(index)}.rating`] =
              `Choose a rating from ${String(min)} to ${String(max)}.`
          }
        })
        if (Object.keys(errors).length > 0) return invalid(errors)
        const key = part === 'self' ? 'selfRating' : 'managerRating'
        const note = part === 'self' ? 'selfComment' : 'managerComment'
        const ratingsNext = criteria.map((criterion) => {
          const stored = item.ratings.find((row) => row.criterionId === criterion.id) ?? {
            criterionId: criterion.id,
            selfRating: null,
            selfComment: null,
            managerRating: null,
            managerComment: null,
          }
          const given = sent.find((row) => row.criterionId === criterion.id)
          return given
            ? { ...stored, [key]: given.rating ?? null, [note]: blank(given.comment) }
            : stored
        })
        if (body.submit) {
          const missing: Record<string, string> = {}
          ratingsNext.forEach((row, index) => {
            if (row[key] === null) missing[`ratings.${String(index)}.rating`] = 'Choose a rating.'
          })
          if (Object.keys(missing).length > 0) {
            return invalid(
              { ratings: 'Rate every criterion before submitting.', ...missing },
              'Rate every criterion before submitting.',
            )
          }
        }
        const next: AppraisalRec = {
          ...item,
          ratings: ratingsNext,
          ...(part === 'self'
            ? { selfComments: body.comments ?? item.selfComments }
            : {
                managerComments: body.comments ?? item.managerComments,
                developmentNeeds: body.developmentNeeds ?? item.developmentNeeds,
              }),
          ...(body.submit
            ? part === 'self'
              ? { status: 'manager_review' as const, selfSubmittedAt: now() }
              : { status: 'reviewed' as const, managerSubmittedAt: now() }
            : {}),
          updatedAt: now(),
          rowVersion: newRowVersion(),
        }
        appraisals.update(item.id, next)
        return HttpResponse.json<ApiItem<AppraisalDetailDto>>({ data: appraisalDetailOut(next) })
      }),
    ),
  ),
]

/** Restores the module's mock tables to their seed data (used between tests). */
export function resetPerformanceDb(): void {
  resetPerformanceTables()
}
