/*
 * Records of the in-browser mock database (`src/mocks/scheduling/`). The mock APIs of other
 * modules (attendance, requests, leaves, payroll) read and write schedule entries in this
 * shape, so it stays as it was. None of these is an API shape: the planner's API types are
 * in `scheduling.types.ts` (`BoardShift`, `ScheduleDetail`, …).
 */

export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const
/** Mock store: an employee's status in the mock directory. */
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYMENT_TYPES = ['permanent', 'probation', 'contract', 'intern'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const GENDERS = ['female', 'male'] as const
export type Gender = (typeof GENDERS)[number]

export const BREAK_TYPES = ['lunch', 'rest', 'personal', 'prayer'] as const
/** Mock store: the fixed break kinds of the old mock (the API has break type records). */
export type BreakType = (typeof BREAK_TYPES)[number]

/** Monday first, as the weekday chips are drawn. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** Mock store: a break on a schedule entry. */
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

/** Mock store: how the working time of an entry's slot is counted. */
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

/**
 * Mock store: one employee on one date, a shift or a rest day. The mock planner API turns
 * these into the API's shifts and rest days.
 */
export interface ScheduleEntry {
  id: string
  employeeId: string
  /** `yyyy-MM-dd`. */
  date: string
  kind: 'shift' | 'rest'
  /** Time roster (Roster → roster group) the times came from. */
  rosterGroupId: string | null
  /** The time slot (mock settings), when known; otherwise found from the clock times. */
  timeSlotId?: string | null | undefined
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

/** "Repeat" of a mock rest-day batch: weekdays between two dates, every n weeks. */
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

export type GeoFenceShape =
  | { type: 'circle'; latitude: number; longitude: number; radiusMeters: number }
  | { type: 'polygon'; points: { latitude: number; longitude: number }[] }

/** Mock store: a geo fence (Attendance settings' mock reads and writes these). */
export interface GeoFence {
  id: string
  name: string
  shape: GeoFenceShape
  createdAt: string
}

export type GeoFenceInput = Omit<GeoFence, 'id' | 'createdAt'>
