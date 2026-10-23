import type { Paginated } from '@/types/api'

/**
 * Day states, in the order of the Attendance Overview legend. One of them
 * describes each scheduled day of each person.
 */
export const DAY_STATUSES = [
  'present',
  'absent',
  'holiday',
  'half-day',
  'short-day',
  'leave',
  'half-leave',
  'short-leave',
  'sandwich',
  'official-visit',
  'leave-applied',
  'yet-to-start',
  'weekend',
  'workable-shifts',
  'workable-hours',
  'late-arrival',
  'early-left',
  'rest-day',
  'relaxation',
  'official-duty',
  'wfh',
] as const
export type DayStatus = (typeof DAY_STATUSES)[number]

/** "Clock In Status" / "Clock Out Status" chips of the time sheet. */
export const PUNCH_STATUSES = [
  'present',
  'late-arrival',
  'early-left',
  'missing-punch',
  'absent',
] as const
export type PunchStatus = (typeof PUNCH_STATUSES)[number]

export const OVERVIEW_SCOPES = ['all', 'subordinates'] as const
export type OverviewScope = (typeof OVERVIEW_SCOPES)[number]

export const TIME_SHEET_SCOPES = ['my', 'all'] as const
export type TimeSheetScope = (typeof TIME_SHEET_SCOPES)[number]

export const EMPLOYEE_STATUS_FILTERS = ['active', 'inactive', 'all'] as const
export type EmployeeStatusFilter = (typeof EMPLOYEE_STATUS_FILTERS)[number]

/** Id of a break type from Attendance → Settings → Break Types ("lunch", "prayer"…). */
export type AttendanceBreakType = string

/** Row actions of the time sheet, in the order of the design's icon key. */
export const TIME_SHEET_ACTIONS = [
  'edit',
  'missing-punch',
  'relaxation',
  'view',
  'absent',
  'overtime',
] as const
export type TimeSheetAction = (typeof TIME_SHEET_ACTIONS)[number]

/** What an absent day can be recorded as (the "Absent" row action). */
export const ABSENCE_MARKS = [
  'absent',
  'leave',
  'half-leave',
  'short-leave',
  'official-duty',
  'official-visit',
  'wfh',
] as const
export type AbsenceMark = (typeof ABSENCE_MARKS)[number]

export const PUNCH_TYPES = ['check-in', 'check-out', 'break-out', 'break-in'] as const
export type PunchType = (typeof PUNCH_TYPES)[number]

export const PUNCH_SOURCES = ['machine', 'manual', 'dashboard', 'request', 'import'] as const
export type PunchSource = (typeof PUNCH_SOURCES)[number]

/**
 * Local date-times on the wire are `yyyy-MM-ddTHH:mm` (no time zone), the
 * clock on the office wall. Dates are `yyyy-MM-dd`, times `HH:mm`.
 */
export type LocalDateTime = string

export interface AttendanceEmployee {
  id: string
  code: string
  name: string
  department: string
  designation: string
  status: 'active' | 'inactive'
}

/** The person card at the top of the Edit / View dialogs. */
export interface AttendanceProfile extends AttendanceEmployee {
  location: string | null
  branch: string | null
  company: string | null
  joiningDate: string
  photoUrl: string | null
}

export interface AttendanceBreak {
  type: AttendanceBreakType
  /** "Break Out": when the break started. */
  outAt: LocalDateTime
  /** "Break In": when it ended; null while the break is still running. */
  inAt: LocalDateTime | null
  description: string
}

/** Progress of the monthly warning rule shown in the "Warnings" column. */
export interface WarningMark {
  /** Share of the limit reached so far this month, 0–100. */
  percent: number
  /** "Late Penalty" / "Absent Penalty" on the day a penalty was reached. */
  penalty: string | null
}

/** One row of the time sheet: one person, one day. */
export interface TimeSheetDay {
  employeeId: string
  date: string
  /** Time slot / roster name, e.g. "Morning Work". */
  slotName: string | null
  expectedIn: string | null
  expectedOut: string | null
  checkIn: LocalDateTime | null
  checkOut: LocalDateTime | null
  clockInStatus: PunchStatus | null
  clockOutStatus: PunchStatus | null
  lateMinutes: number
  earlyMinutes: number
  durationMinutes: number | null
  expectedMinutes: number | null
  workedMinutes: number | null
  breakMinutes: number | null
  shiftWorkedMinutes: number | null
  /** Minutes past the expected clock out (counted from 15 minutes). */
  overtimeMinutes: number
  approvedOvertimeMinutes: number | null
  warning: WarningMark | null
  status: DayStatus | null
  manuallyUpdated: boolean
  relaxed: boolean
}

export interface TimeSheetData extends Paginated<TimeSheetDay> {
  employee: AttendanceEmployee
}

/** "Days Overview This Month" tiles. */
export interface DaysOverview {
  /** `yyyy-MM`. */
  month: string
  absent: number
  holiday: number
  lateArrival: number
  present: number
  weekend: number
  yetToStart: number
  overtime: number
  warnings: number
  penalty: number
}

export interface OverviewRow {
  employee: AttendanceEmployee
  totals: { totalDays: number; absent: number; holiday: number; present: number }
  /** Status per day of the month; null when the person was not scheduled. */
  days: Record<string, DayStatus | null>
}

export interface OverviewPage extends Paginated<OverviewRow> {
  /** Every day of the month, `yyyy-MM-dd`. */
  days: string[]
}

export interface AttendanceComment {
  id: string
  author: { id: string; name: string; code: string }
  text: string
  createdAt: string
}

export interface DayDetail {
  day: TimeSheetDay
  profile: AttendanceProfile
  breaks: AttendanceBreak[]
  comments: AttendanceComment[]
  /** The Mark Absent / Half Day / Short Day boxes as HR last saved them. */
  marks: { absent: boolean; halfDay: boolean; shortDay: boolean }
}

export interface HistoryEntry {
  id: string
  editedBy: { id: string; name: string; code: string }
  action: string
  /** "09:58 AM → 10:07 AM" and similar, when a value changed. */
  detail: string | null
  at: string
}

export interface PunchLog {
  id: string
  type: PunchType
  at: LocalDateTime
  description: string
  source: PunchSource
  /** The biometric machine that read a machine punch ("MCH-00001"). */
  machineId: string | null
  manuallyUpdated: boolean
}

/** The signed-in person's clock for today (Clock In / Clock Out). */
export interface ClockState {
  clockedIn: boolean
  lastPunch: PunchLog | null
  /** Settings → Basic → "Employee can mark punch from their dashboard". */
  allowed: boolean
}

export interface AttendanceLookups {
  employees: AttendanceEmployee[]
  departments: string[]
}

export interface OverviewParams {
  scope: OverviewScope
  /** `yyyy-MM`. */
  month: string
  page: number
  pageSize: number
  search?: string
  status?: 'active' | 'inactive'
  employeeId?: string
  department?: string
}

export interface TimeSheetParams {
  /** Omitted: the signed-in person ("My"). */
  employeeId?: string
  from: string
  to: string
  page: number
  pageSize: number
  search?: string
}

export interface DayKey {
  employeeId: string
  date: string
}

export interface DayEditInput {
  checkIn: LocalDateTime | null
  checkOut: LocalDateTime | null
  markAbsent: boolean
  markHalfDay: boolean
  markShortDay: boolean
  breaks: AttendanceBreak[]
}

export interface MissingPunchInput {
  type: 'check-in' | 'check-out'
  at: LocalDateTime
  reason: string
}

export interface RelaxationInput {
  reason: string
}

export interface AbsenceInput {
  markAs: AbsenceMark
  reason: string
}

export interface OvertimeInput {
  approvedMinutes: number
  reason: string
}
