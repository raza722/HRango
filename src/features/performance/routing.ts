import { z } from 'zod'

import { PERF_PAGE_SIZE, PERF_PAGE_SIZES } from './constants'
import {
  APPRAISAL_STATUSES,
  CYCLE_STATUSES,
  GOAL_STATUSES,
  SCOPE_TABS,
} from './types/performance.types'

/*
 * The search params of the Performance pages. Bad values fall back (`.catch`), and the
 * defaults are stripped from the URL by the routes (`stripSearchParams`).
 */

const optionalText = z.string().trim().min(1).optional().catch(undefined)
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)
const page = z.number().int().min(1).default(1).catch(1)
const pageSize = z
  .number()
  .int()
  .refine((size) => (PERF_PAGE_SIZES as readonly number[]).includes(size))
  .default(PERF_PAGE_SIZE)
  .catch(PERF_PAGE_SIZE)
const dialog = z.enum(['add']).optional().catch(undefined)

// --- overview -------------------------------------------------------------------------------

export const OVERVIEW_SEARCH_DEFAULTS = {} as const

/** `/performance/overview?employeeId=`: whose overview (default the caller). */
export const overviewSearchSchema = z.object({ employeeId: optionalText })
export type OverviewSearch = z.infer<typeof overviewSearchSchema>

// --- goals ----------------------------------------------------------------------------------

export const GOALS_SEARCH_DEFAULTS = { tab: 'my', page: 1, pageSize: PERF_PAGE_SIZE } as const

/**
 * `/performance/goals?tab=my|team|all&status&cycleId&overdue=true&dueFrom&dueTo&q&employeeId
 * &page&pageSize&dialog=add&edit=<id>&goal=<id>&checkIn=<id>`: the tab, the filters, the pager,
 * and the open Add / Edit, detail or Check In popup.
 */
export const goalsSearchSchema = z.object({
  tab: z.enum(SCOPE_TABS).default('my').catch('my'),
  status: z.enum(GOAL_STATUSES).optional().catch(undefined),
  cycleId: optionalText,
  overdue: z.literal(true).optional().catch(undefined),
  dueFrom: optionalDate,
  dueTo: optionalDate,
  q: optionalText,
  employeeId: optionalText,
  page,
  pageSize,
  dialog,
  edit: optionalText,
  goal: optionalText,
  checkIn: optionalText,
})
export type GoalsSearch = z.infer<typeof goalsSearchSchema>

// --- KPIs -----------------------------------------------------------------------------------

export const KPIS_SEARCH_DEFAULTS = { page: 1, pageSize: PERF_PAGE_SIZE } as const

/** `/performance/kpis?q&keyResultArea&departmentId&active=yes|no&page&pageSize&dialog&edit`. */
export const kpisSearchSchema = z.object({
  q: optionalText,
  keyResultArea: optionalText,
  departmentId: optionalText,
  active: z.enum(['yes', 'no']).optional().catch(undefined),
  page,
  pageSize,
  dialog,
  edit: optionalText,
})
export type KpisSearch = z.infer<typeof kpisSearchSchema>

// --- cycles ---------------------------------------------------------------------------------

export const CYCLES_SEARCH_DEFAULTS = { page: 1, pageSize: PERF_PAGE_SIZE } as const

/** `/performance/cycles?status&q&page&pageSize&dialog=add&edit=<id>&cycle=<id>`. */
export const cyclesSearchSchema = z.object({
  status: z.enum(CYCLE_STATUSES).optional().catch(undefined),
  q: optionalText,
  page,
  pageSize,
  dialog,
  edit: optionalText,
  cycle: optionalText,
})
export type CyclesSearch = z.infer<typeof cyclesSearchSchema>

// --- appraisals -----------------------------------------------------------------------------

export const APPRAISALS_SEARCH_DEFAULTS = {
  tab: 'all',
  page: 1,
  pageSize: PERF_PAGE_SIZE,
} as const

/**
 * The Appraisals page's URL state, wherever it is shown (`/performance/appraisals`, or beside
 * the Payroll Settings menu): `?tab=my|team|all&cycleId&status&employeeId&q&page&pageSize
 * &appraisal=<id>&finalise=true`.
 */
export const appraisalsSearchSchema = z.object({
  tab: z.enum(SCOPE_TABS).default('all').catch('all'),
  cycleId: optionalText,
  status: z.enum(APPRAISAL_STATUSES).optional().catch(undefined),
  employeeId: optionalText,
  q: optionalText,
  page,
  pageSize,
  appraisal: optionalText,
  finalise: z.literal(true).optional().catch(undefined),
})
export type AppraisalsSearch = z.infer<typeof appraisalsSearchSchema>

// --- reviews --------------------------------------------------------------------------------

export const REVIEWS_SEARCH_DEFAULTS = { tab: 'my', page: 1, pageSize: PERF_PAGE_SIZE } as const

/** `/performance/reviews?tab=my|team|all&cycleId&status&q&page&pageSize&review=<id>`. */
export const reviewsSearchSchema = z.object({
  tab: z.enum(SCOPE_TABS).default('my').catch('my'),
  cycleId: optionalText,
  status: z.enum(APPRAISAL_STATUSES).optional().catch(undefined),
  q: optionalText,
  page,
  pageSize,
  review: optionalText,
})
export type ReviewsSearch = z.infer<typeof reviewsSearchSchema>
