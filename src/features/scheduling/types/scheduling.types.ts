/**
 * Scheduling (`/api/scheduling/...`): which shift each employee works on which date. A
 * shift is one time slot on one work date; rest days and holidays come alongside. Shapes
 * follow the backend (`backend/app/schemas/scheduling.py`): ids are strings, dates
 * `yyyy-MM-dd`, times `HH:mm:ss`, date-times local wall clock `yyyy-MM-ddTHH:mm:ss`.
 */

import type { PaginationMeta } from '@/types/api'

/** Board tabs: your own schedule, everyone, or the people who report to you. */
export const SCHEDULE_SCOPES = ['my', 'all', 'subordinates'] as const
export type ScheduleScope = (typeof SCHEDULE_SCOPES)[number]

/** Board period: a week, a month (days scroll sideways) or a year (month totals). */
export const SCHEDULE_VIEWS = ['week', 'month', 'year'] as const
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number]

/** `hr.employee.status` values the board can filter on. */
export const EMPLOYEE_STATUS_FILTERS = [
  'active',
  'probation',
  'notice',
  'inactive',
  'left',
] as const
export type EmployeeStatusFilter = (typeof EMPLOYEE_STATUS_FILTERS)[number]

/** "Repeat": 0 = none (every week of the range), otherwise every 1–8 weeks. */
export const REPEAT_WEEKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const
export type RepeatWeeks = (typeof REPEAT_WEEKS)[number]

// --- the board ------------------------------------------------------------------------------

/** A person on the board, with planned minutes and shifts in the requested range. */
export interface BoardEmployee {
  id: string
  code: string
  name: string
  designationName: string | null
  departmentName: string | null
  status: string
  defaultTimeSlotId: string | null
  defaultTimeSlotName: string | null
  plannedMinutes: number
  shiftCount: number
}

/** A shift on the board. */
export interface BoardShift {
  id: string
  workDate: string
  /** Local wall clock; `endAt` is the next day for an overnight shift. */
  startAt: string
  endAt: string
  timeSlotId: string
  timeSlotCode: string
  timeSlotName: string
  timeSlotColor: string | null
  isFlexible: boolean
  isOvernight: boolean
  geoFenceId: string | null
  geoFenceName: string | null
  isWfh: boolean
  plannedMinutes: number
  scheduleBatchId: string | null
  rowVersion: string
}

export interface BoardRestDay {
  id: string
  restDate: string
  isPayable: boolean
  restDayRuleId: string | null
  requestId: string | null
}

export interface BoardHoliday {
  holidayDate: string
  holidayId: string
  holidayName: string
  holidayType: string
  attendanceExempt: boolean
}

export interface BoardRow {
  employee: BoardEmployee
  shifts: BoardShift[]
  restDays: BoardRestDay[]
  holidays: BoardHoliday[]
}

export interface DayTotal {
  workDate: string
  plannedMinutes: number
  shiftCount: number
}

/** `GET /scheduling/schedules`. */
export interface BoardPage {
  data: BoardRow[]
  meta: PaginationMeta
  /** Planned minutes per date over every matching employee (not just this page). */
  dayTotals: DayTotal[]
}

export interface YearMonth {
  /** 1–12; only months with something planned are sent. */
  month: number
  plannedMinutes: number
  shiftCount: number
  restDays: number
}

export interface YearRow {
  employee: BoardEmployee
  months: YearMonth[]
}

/** `GET /scheduling/schedules/year`. */
export interface YearPage {
  data: YearRow[]
  meta: PaginationMeta
}

/** The planner's filters, as the API names them. */
export interface BoardFilters {
  search?: string
  employeeId?: string
  departmentId?: string
  branchId?: string
  locationId?: string
  designationId?: string
  employmentTypeId?: string
  employeeGroupId?: string
  gradeId?: string
  employeeStatus?: string
  timeSlotId?: string
  rosterGroupId?: string
}

export interface BoardParams extends BoardFilters {
  scope: ScheduleScope
  /** `yyyy-MM-dd`, inclusive (at most 93 days). */
  from: string
  to: string
  page: number
  pageSize: number
}

export interface YearParams extends BoardFilters {
  scope: ScheduleScope
  year: number
  page: number
  pageSize: number
}

/** "Active Status" box: the signed-in person's shift today (from the My board). */
export interface ActiveShift {
  slotName: string | null
  /** `HH:mm`. */
  clockIn: string | null
  clockOut: string | null
}

// --- one shift ------------------------------------------------------------------------------

export interface ScheduleBreakDetail {
  id: string
  breakTypeId: string
  breakTypeName: string
  startAt: string
  endAt: string
  isInclusive: boolean
}

/** `GET /scheduling/schedules/{id}`. */
export interface ScheduleDetail {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  workDate: string
  startAt: string
  endAt: string
  timeSlotId: string
  timeSlotCode: string
  timeSlotName: string
  timeSlotColor: string | null
  isFlexible: boolean
  isOvernight: boolean
  fullOvertime: boolean
  shortOvertime: boolean
  scheduleBatchId: string | null
  geoFenceId: string | null
  geoFenceName: string | null
  isWfh: boolean
  plannedMinutes: number
  isRestDay: boolean
  breaks: ScheduleBreakDetail[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** A break sent with a shift or a batch. */
export interface BreakInput {
  breakTypeId: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  /** Counts as working time. */
  isInclusive: boolean
}

/** `POST /scheduling/schedules` (add) and `PUT /scheduling/schedules/{id}` (edit). */
export interface ScheduleInput {
  /** Required when adding; an edit keeps the employee (swap moves a shift to someone else). */
  employeeId?: string
  workDate: string
  timeSlotId: string
  /** Both or neither: other times than the slot's for this day (`HH:mm`). */
  startTime: string | null
  endTime: string | null
  geoFenceId: string | null
  isWfh: boolean
  /** This shift's breaks; leave out to take the time slot's breaks. */
  breaks?: BreakInput[] | null
  rowVersion?: string
}

/** `POST /scheduling/schedules/{id}/swap`: exchange with a shift, or give it to someone. */
export interface SwapInput {
  withScheduleId?: string
  withEmployeeId?: string
  rowVersion?: string
}

// --- batches --------------------------------------------------------------------------------

/** Create Scheduling: a time slot or a roster group's week over a date range. */
export interface ScheduleBatchInput {
  startDate: string
  endDate: string
  timeSlotId: string | null
  rosterGroupId: string | null
  /** 1 = Monday … 7 = Sunday; empty = every day. */
  weekdays: number[]
  /** 0 = every week, 1–8 = a cycle of n weeks of which the first `step` are on. */
  repeatEveryWeeks: number
  step: number
  geoFenceId: string | null
  isWfh: boolean
  /** With a roster group and none: its members enrolled on each date. */
  employeeIds: string[]
  /** Replaces the time slots' breaks on every shift; `null` keeps them. */
  breaks: BreakInput[] | null
  /** Replace shifts already planned on these dates instead of refusing (409). */
  replaceExisting: boolean
}

/** Apply Default Shift: each person's roster (when enrolled) or default time slot. */
export interface DefaultShiftInput {
  startDate: string
  endDate: string
  employeeIds: string[]
  replaceExisting: boolean
}

export interface ScheduleBatchResult {
  id: string
  batchKind: string
  startDate: string
  endDate: string
  timeSlotId: string | null
  timeSlotName: string | null
  rosterGroupId: string | null
  rosterGroupTitle: string | null
  weekdays: number[]
  repeatEveryWeeks: number
  step: number
  geoFenceId: string | null
  isWfh: boolean
  createdCount: number
  replacedCount: number
  skippedRestDays: number
  skippedNoShift: number
  createdAt: string
}

/** `POST /scheduling/schedules/bulk-delete`: ids (Multi Delete) or a range (Delete Scheduling). */
export interface BulkDeleteInput {
  ids?: string[]
  startDate?: string
  endDate?: string
  employeeIds?: string[]
  allEmployees?: boolean
  /** Also delete rest days in the range (range only). */
  deleteRestDays?: boolean
}

export interface BulkDeleteResult {
  deletedSchedules: number
  deletedRestDays: number
}

/** `POST /scheduling/schedules/bulk-edit`: only the fields given change. */
export interface BulkEditInput {
  ids: string[]
  timeSlotId?: string
  geoFenceId?: string
  clearGeoFence?: boolean
  isWfh?: boolean
}

export interface BulkEditResult {
  updatedSchedules: number
}

// --- rest days (Scheduling settings) --------------------------------------------------------

/** `POST /scheduling/settings/rest-days`: a rule that makes rest days. */
export interface RestDayRuleInput {
  fromDate: string
  toDate: string
  /** 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  repeatEveryWeeks: number
  step: number
  isPayable: boolean
  employeeIds: string[]
}

export interface RestDayRule {
  id: string
  fromDate: string
  toDate: string
  weekdays: number[]
  repeatEveryWeeks: number
  step: number
  isPayable: boolean
  employeeCount: number
  /** Rest days this rule made (dates already rest days are not counted). */
  restDayCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `POST /scheduling/settings/rest-days/delete-range`. */
export interface RestDayRangeDeleteInput {
  startDate: string
  endDate: string
  employeeIds: string[]
  allEmployees: boolean
}

// --- pickers ----------------------------------------------------------------------------------

/** `GET /scheduling/options/{time-slots,break-types,roster-groups}`. */
export interface SchedulingOption {
  id: string
  name: string
  code: string | null
  startTime: string | null
  endTime: string | null
  isOvernight: boolean | null
  isFlexible: boolean | null
}

/** A geo fence to pick (`GET /attendance/settings/geo-fences`, the fields used here). */
export interface GeoFenceOption {
  id: string
  name: string
  code?: string
  shape?: string
  radiusM?: number | null
  isActive?: boolean
}

/** `GET /organisation/lookups/{kind}`. */
export interface LookupItem {
  id: string
  name: string
  code: string | null
  parentId: string | null
}

export const ORG_LOOKUP_KINDS = [
  'locations',
  'branches',
  'departments',
  'designations',
  'grades',
  'employee-groups',
  'employment-types',
] as const
export type OrgLookupKind = (typeof ORG_LOOKUP_KINDS)[number]

/** A person in the Select Employees lists (`GET /employees/lookup`). */
export interface PickableEmployee {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentName: string | null
  branchName: string | null
  status: string
  photoUrl: string | null
}

/** Filters of the Select Employees panels the lookup understands. */
export interface EmployeeFilters {
  search?: string
  branchId?: string
  departmentId?: string
}

export * from './mock-store.types'
