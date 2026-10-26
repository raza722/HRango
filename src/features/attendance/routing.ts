import { z } from 'zod'

import { TIME_SHEET_PAGE_SIZES } from './constants'
import {
  DAY_FLAGS,
  DAY_STATUSES,
  EMPLOYEE_STATUS_FILTERS,
  OVERVIEW_SCOPES,
  PUNCH_SOURCES,
  PUNCH_TYPES,
  TIME_SHEET_SCOPES,
} from './types/attendance.types'

const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined)
const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

/** Defaults left out of the Attendance Overview URL. */
export const OVERVIEW_SEARCH_DEFAULTS = { scope: 'all', page: 1, status: 'active' } as const

/**
 * `/attendance/overview?scope=all&month=2026-10&page=1&q=…&departmentId=…`.
 * The month defaults to the current one. (The API has no employee filter here; search by name.)
 */
export const overviewSearchSchema = z.object({
  scope: z.enum(OVERVIEW_SCOPES).default('all').catch('all'),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
  q: optionalText,
  status: z.enum(EMPLOYEE_STATUS_FILTERS).default('active').catch('active'),
  departmentId: optionalText,
})
export type OverviewSearch = z.infer<typeof overviewSearchSchema>

/** Defaults left out of the Time Sheet URL. */
export const TIME_SHEET_SEARCH_DEFAULTS = {
  scope: 'my',
  page: 1,
  pageSize: 10,
  status: 'active',
} as const

/**
 * `/attendance/time-sheet?scope=all&employeeId=…&from=…&to=…&flag=missing_punch`. My shows the
 * signed-in person; Subordinates and All everyone the user reaches, or the person picked in
 * Employee Name. From / To default to this month up to today.
 */
export const timeSheetSearchSchema = z.object({
  scope: z.enum(TIME_SHEET_SCOPES).default('my').catch('my'),
  employeeId: optionalText,
  status: z.enum(EMPLOYEE_STATUS_FILTERS).default('active').catch('active'),
  from: optionalDay,
  to: optionalDay,
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .number()
    .int()
    .refine((size) => (TIME_SHEET_PAGE_SIZES as readonly number[]).includes(size))
    .default(10)
    .catch(10),
  q: optionalText,
  dayStatus: z.enum(DAY_STATUSES).optional().catch(undefined),
  flag: z.enum(DAY_FLAGS).optional().catch(undefined),
})
export type TimeSheetSearch = z.infer<typeof timeSheetSearchSchema>

export const SETTINGS_TABS = [
  'basic',
  'scheduling',
  'rest-days',
  'break-types',
  'ip-restrictions',
  'geo-fencing',
  'holidays',
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** `/attendance/settings?tab=holidays`. */
export const settingsSearchSchema = z.object({
  tab: z.enum(SETTINGS_TABS).default('basic').catch('basic'),
})
export const SETTINGS_SEARCH_DEFAULTS = { tab: 'basic' } as const

/** `/attendance/logs?from=…&to=…&employeeId=…&type=check_in&source=biometric&page=2`; dates default to today. */
export const logsSearchSchema = z.object({
  from: optionalDay,
  to: optionalDay,
  employeeId: optionalText,
  type: z.enum(PUNCH_TYPES).optional().catch(undefined),
  source: z.enum(PUNCH_SOURCES).optional().catch(undefined),
  q: optionalText,
  page: z.number().int().min(1).default(1).catch(1),
})
export type LogsSearch = z.infer<typeof logsSearchSchema>
export const LOGS_SEARCH_DEFAULTS = { page: 1 } as const
