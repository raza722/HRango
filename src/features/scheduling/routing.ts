import { z } from 'zod'

import { EMPLOYEE_STATUS_FILTERS, SCHEDULE_SCOPES, SCHEDULE_VIEWS } from './types/scheduling.types'
import { isDay } from './utils/schedule-dates'

const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined)
/** An id from the API (organisation lookups, employees, time slots, roster groups). */
const optionalId = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().trim().min(1).max(40))
  .optional()
  .catch(undefined)
const optionalDay = z.string().refine(isDay).optional().catch(undefined)

/** Defaults left out of the URL. */
export const SCHEDULING_SEARCH_DEFAULTS = {
  scope: 'my',
  view: 'month',
  page: 1,
  status: 'all',
} as const

/**
 * `/scheduling?scope=all&view=month&date=2026-10-21&page=1&q=…&departmentId=…`.
 * The tab, period, page, search and filters live in the URL so a view can be shared or
 * bookmarked. `from` + `to` (Date From / Date To) override the period. Filters are the
 * API's ids (`GET /scheduling/schedules` takes them as they are).
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
  /** `hr.employee.status`, or every status. */
  status: z
    .enum([...EMPLOYEE_STATUS_FILTERS, 'all'])
    .default('all')
    .catch('all'),
  employeeId: optionalId,
  departmentId: optionalId,
  branchId: optionalId,
  locationId: optionalId,
  designationId: optionalId,
  employmentTypeId: optionalId,
  employeeGroupId: optionalId,
  gradeId: optionalId,
  timeSlotId: optionalId,
  rosterGroupId: optionalId,
})

export type SchedulingSearch = z.infer<typeof schedulingSearchSchema>

/** Filter keys reset together by "Clear filters". */
export const FILTER_KEYS = [
  'from',
  'to',
  'employeeId',
  'departmentId',
  'branchId',
  'locationId',
  'designationId',
  'employmentTypeId',
  'employeeGroupId',
  'gradeId',
  'timeSlotId',
  'rosterGroupId',
] as const satisfies readonly (keyof SchedulingSearch)[]
