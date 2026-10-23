/**
 * Scheduling: which shift each employee works on each day. A schedule entry is
 * one employee on one date: a shift (times from a time roster) or a rest day.
 * Entries are created in batches (Create Scheduling, Apply Default Shift,
 * Create New Rest Day) and changed one by one or many at once on the board.
 */

/** Board tabs: your own schedule, everyone, or the people who report to you. */
export const SCHEDULE_SCOPES = ['my', 'all', 'subordinates'] as const
export type ScheduleScope = (typeof SCHEDULE_SCOPES)[number]

/** Board period: a week, a month (days scroll sideways) or a year (month totals). */
export const SCHEDULE_VIEWS = ['week', 'month', 'year'] as const
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number]

export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYMENT_TYPES = ['permanent', 'probation', 'contract', 'intern'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const GENDERS = ['female', 'male'] as const
export type Gender = (typeof GENDERS)[number]

export const BREAK_TYPES = ['lunch', 'rest', 'personal', 'prayer'] as const
export type BreakType = (typeof BREAK_TYPES)[number]

/** Monday first, as the weekday chips are drawn. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** "Repeat": 0 = none, otherwise every 1–8 weeks. */
export const REPEAT_WEEKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const
export type RepeatWeeks = (typeof REPEAT_WEEKS)[number]

export interface ScheduleBreak {
  type: BreakType
  /** `yyyy-MM-dd`: the break applies on these dates of the schedule. */
  startDate: string
  endDate: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  description: string
  /** The break is part of the paid shift time. */
  inclusive: boolean
}

/** How the working time of a slot is counted. */
export interface TimeSlotRules {
  /** Name shown on the board, e.g. "Night Shift". */
  name: string
  isOvernight: boolean
  /** The employee may decide the order of breaks and work ("Reverse Decision"). */
  reverseDecision: boolean
  /** `flexible`: a number of workable hours per day; `total`: hours per period. */
  mode: 'fixed' | 'flexible' | 'total'
  workableMinutes: number | null
  totalMinutes: number | null
  shortOvertime: boolean
  fullOvertime: boolean
  /** Allowed overtime when either overtime box is ticked. */
  overtimeMinutes: number | null
}

export interface ScheduleEntry {
  id: string
  employeeId: string
  /** `yyyy-MM-dd`. */
  date: string
  kind: 'shift' | 'rest'
  /** Time roster (Roster → roster group) the times came from. */
  rosterGroupId: string | null
  /** `HH:mm`; `null` on rest days. A clock out before the clock in ends the next day. */
  clockIn: string | null
  clockOut: string | null
  workFromHome: boolean
  geoFenceIds: string[]
  breaks: ScheduleBreak[]
  slot: TimeSlotRules
  /** Rest days only. */
  restDayPayable: boolean
  /** Entries created together share a batch (one Create Scheduling run). */
  batchId: string
  createdAt: string
  updatedAt: string
}

/** A person on the board. */
export interface ScheduleEmployee {
  id: string
  code: string
  name: string
  designation: string
  department: string
  status: EmployeeStatus
  /** Usual slot, shown as the badge under the name ("Day Shift"). */
  defaultSlot: string
}

export interface BoardRow {
  employee: ScheduleEmployee
  entries: ScheduleEntry[]
  /** Planned minutes of the shifts in the period. */
  plannedMinutes: number
  /** Has a shift on today's date. */
  onShiftToday: boolean
}

export interface BoardParams {
  scope: ScheduleScope
  /** `yyyy-MM-dd`, inclusive. */
  from: string
  to: string
  page: number
  pageSize: number
  search?: string
  status?: EmployeeStatus
  group?: string
  locationId?: string
  branchId?: string
  department?: string
  employeeId?: string
  employmentType?: EmploymentType
  rosterGroupId?: string
}

export interface BoardPage {
  data: BoardRow[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
  /** Planned minutes per date across every matching employee. */
  dayTotals: Record<string, number>
}

/** "Active Status" box: the signed-in person's shift today. */
export interface ActiveShift {
  slotName: string | null
  clockIn: string | null
  clockOut: string | null
}

export type GeoFenceShape =
  | { type: 'circle'; latitude: number; longitude: number; radiusMeters: number }
  | { type: 'polygon'; points: { latitude: number; longitude: number }[] }

export interface GeoFence {
  id: string
  name: string
  shape: GeoFenceShape
  createdAt: string
}

export type GeoFenceInput = Omit<GeoFence, 'id' | 'createdAt'>

/** Filters of the Select Employees panels. */
export interface EmployeeFilters {
  employeeId?: string
  locationId?: string
  designation?: string
  department?: string
  grade?: string
  employmentType?: EmploymentType
  group?: string
  branchId?: string
  gender?: Gender
  status?: EmployeeStatus
}

/** A person in the Select Employees lists. */
export interface PickableEmployee {
  id: string
  code: string
  name: string
  designation: string
}

export interface SchedulingLookups {
  departments: string[]
  designations: string[]
  groups: string[]
  grades: string[]
  employees: PickableEmployee[]
}

export interface RepeatRule {
  /** 1–8: "Every Week" … "Every 8 Week". */
  everyWeeks: number
  /** `yyyy-MM-dd`. */
  from: string
  to: string
  weekdays: Weekday[]
  /** Consecutive weeks scheduled in each cycle (1 = only the first week). */
  step: number
}

/** Create Scheduling: both wizard steps together. */
export interface CreateScheduleInput {
  startDate: string
  endDate: string
  rosterGroupId: string
  geoFenceIds: string[]
  repeat: RepeatRule | null
  /** Roster weekend days become rest days instead of being left empty. */
  restDays: boolean
  workFromHome: boolean
  breaks: ScheduleBreak[]
  slot: TimeSlotRules
  /** Times of the slot; `null` keeps each weekday's roster times. */
  clockIn: string | null
  clockOut: string | null
  employeeIds: string[]
}

export interface ApplyDefaultShiftInput {
  startDate: string
  endDate: string
  rosterGroupId: string
  employeeIds: string[]
}

export interface DeleteScheduleInput {
  startDate: string
  endDate: string
  deleteRestDays: boolean
  allEmployees: boolean
  employeeIds: string[]
}

export interface RestDayInput {
  startDate: string
  repeat: RepeatRule
  payable: boolean
  employeeIds: string[]
}

/** Fields "Edit Scheduling" / "Scheduling Edit" can change. */
export interface EntryPatch {
  rosterGroupId?: string
  geoFenceIds?: string[]
  workFromHome?: boolean
  /** Turns the entry into a rest day (true) or back into a shift (false). */
  restDay?: boolean
  slot?: Partial<TimeSlotRules>
  breaks?: ScheduleBreak[]
}

export interface SwapInput {
  entryId: string
  targetEmployeeId: string
  targetDate: string
}

/** One row of an imported CSV. */
export interface ImportRow {
  employeeCode: string
  date: string
  clockIn: string | null
  clockOut: string | null
  restDay: boolean
}

export interface BatchResult {
  created: number
  updated: number
  deleted: number
  skipped: number
}
