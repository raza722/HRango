import { z } from 'zod'

import { EMPLOYMENT_TYPES, SCHEDULE_SCOPES, SCHEDULE_VIEWS } from './types/scheduling.types'
import { isDay } from './utils/schedule-dates'

const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined)
const optionalDay = z.string().refine(isDay).optional().catch(undefined)

/** Defaults left out of the URL. */
export const SCHEDULING_SEARCH_DEFAULTS = {
  scope: 'my',
  view: 'month',
  page: 1,
  status: 'active',
} as const

/**
 * `/scheduling?scope=all&view=month&date=2026-10-21&page=1&q=…&department=…`.
 * The tab, period, page, search and filters live in the URL so a view can be
 * shared or bookmarked. `from` + `to` (Date From / Date To) override the period.
 */
export const schedulingSearchSchema = z.object({
  scope: z.enum(SCHEDULE_SCOPES).default('my').catch('my'),
  view: z.enum(SCHEDULE_VIEWS).default('month').catch('month'),
  /** Any day inside the period; today when absent. */
  date: optionalDay,
  from: optionalDay,
  to: optionalDay,
  page: z.number().int().min(1).default(1).catch(1),
  q: optionalText,
  status: z.enum(['active', 'inactive', 'all']).default('active').catch('active'),
  group: optionalText,
  locationId: optionalText,
  branchId: optionalText,
  department: optionalText,
  employeeId: optionalText,
  employmentType: z.enum(EMPLOYMENT_TYPES).optional().catch(undefined),
  rosterGroupId: optionalText,
})

export type SchedulingSearch = z.infer<typeof schedulingSearchSchema>

/** Filter keys reset together by "Clear filters". */
export const FILTER_KEYS = [
  'from',
  'to',
  'group',
  'locationId',
  'branchId',
  'department',
  'employeeId',
  'employmentType',
  'rosterGroupId',
] as const satisfies readonly (keyof SchedulingSearch)[]
