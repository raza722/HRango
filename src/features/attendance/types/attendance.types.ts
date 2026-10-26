import type { FileRef } from '@/lib/files'
import type { Paginated } from '@/types/api'

/**
 * Shapes of `/api/attendance` (backend `app/schemas/attendance.py`). Date-times are the company's
 * local wall-clock time: the API sends `yyyy-MM-ddTHH:mm:ss` without a zone; `attendance.api.ts`
 * trims them to {@link LocalDateTime} (`yyyy-MM-ddTHH:mm`) and adds `:00` back on the way out.
 */

/** Day states of the time sheet and the overview (`dayStatus`), in the legend's order. */
export const DAY_STATUSES = [
  'present',
  'absent',
  'holiday',
  'half_day',
  'short_day',
  'leave',
  'sandwich',
  'official_visit',
  'yet_to_start',
  'weekend',
  'rest_day',
  'wfh',
] as const
export type DayStatus = (typeof DAY_STATUSES)[number]

/** What else happened on a day (`flags`): shown as small marks beside the state. */
export const DAY_FLAGS = [
  'late',
  'early',
  'grace',
  'overtime',
  'missing_punch',
  'relaxation',
  'official_visit',
  'half_leave',
  'short_leave',
] as const
export type DayFlag = (typeof DAY_FLAGS)[number]

/** "Clock In Status" / "Clock Out Status" chips of the time sheet. */
export const PUNCH_STATUSES = [
  'on_time',
  'grace',
  'late',
  'early',
  'overtime',
  'missing',
  'absent',
] as const
export type PunchStatus = (typeof PUNCH_STATUSES)[number]

export const OVERVIEW_SCOPES = ['all', 'subordinates'] as const
export type OverviewScope = (typeof OVERVIEW_SCOPES)[number]

export const TIME_SHEET_SCOPES = ['my', 'subordinates', 'all'] as const
export type TimeSheetScope = (typeof TIME_SHEET_SCOPES)[number]

export const EMPLOYEE_STATUS_FILTERS = ['active', 'inactive', 'all'] as const
export type EmployeeStatusFilter = (typeof EMPLOYEE_STATUS_FILTERS)[number]

/** Id of a break type (Attendance → Settings → Break Types). */
export type AttendanceBreakType = string

/**
 * Row actions of the time sheet. Only Edit and View reach the API; Missing Punch, Relaxation,
 * Absent and Overtime are requests (requests module) and are no longer offered here.
 */
export const TIME_SHEET_ACTIONS = [
  'edit',
  'missing-punch',
  'relaxation',
  'view',
  'absent',
  'overtime',
] as const
export type TimeSheetAction = (typeof TIME_SHEET_ACTIONS)[number]

/** Mark Absent / Mark Half Day / Mark Short Day of the day edit (`markedStatus`). */
export const DAY_MARKS = ['absent', 'half_day', 'short_day'] as const
export type DayMark = (typeof DAY_MARKS)[number]

/**
 * Legacy: The "Absent" row action is a request now (leave, official visit, WFH); kept so the
 * public names stay. Not sent to the API.
 */
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

export const PUNCH_TYPES = ['check_in', 'check_out', 'break_out', 'break_in'] as const
export type PunchType = (typeof PUNCH_TYPES)[number]

/** Where a punch came from (`source`). */
export const PUNCH_SOURCES = [
  'biometric',
  'mobile',
  'web',
  'manual',
  'import_file',
  'punch_request',
] as const
export type PunchSource = (typeof PUNCH_SOURCES)[number]

/** `yyyy-MM-ddTHH:mm` (no zone): the clock on the office wall. Dates `yyyy-MM-dd`, times `HH:mm`. */
export type LocalDateTime = string

/** A person as the time-sheet rows name them. */
export interface AttendanceEmployee {
  id: string
  code: string
  name: string
  department: string | null
  designation: string | null
  status: string | null
}

/** The person card at the top of the Edit / View dialogs (what the day carries). */
export interface AttendanceProfile extends AttendanceEmployee {
  location: string | null
  branch: string | null
  company: string | null
  joiningDate: string | null
  photoUrl: string | null
}

/** One break of a day (`breaks[]` of the day detail). */
export interface AttendanceBreak {
  id: string | null
  breakTypeId: AttendanceBreakType | null
  breakTypeName: string | null
  /** "Break Out": when the break started. */
  outAt: LocalDateTime
  /** "Break In": when it ended; null while the break is still running. */
  inAt: LocalDateTime | null
  minutes: number | null
}

/** One row of the time sheet: one person, one day (`TimesheetDayOut`). */
export interface TimeSheetDay {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  /** `yyyy-MM-dd` (`workDate`). */
  workDate: string
  scheduleId: string | null
  timeSlotId: string | null
  timeSlotName: string | null
  expectedIn: LocalDateTime | null
  expectedOut: LocalDateTime | null
  expectedMinutes: number | null
  firstIn: LocalDateTime | null
  lastOut: LocalDateTime | null
  workedMinutes: number | null
  breakMinutes: number | null
  shiftWorkedMinutes: number | null
  lateMinutes: number | null
  earlyLeftMinutes: number | null
  overtimeBeforeMinutes: number | null
  overtimeAfterMinutes: number | null
  approvedOvertimeMinutes: number | null
  graceConsumedMinutes: number | null
  dayStatus: DayStatus
  markedStatus: DayMark | null
  leaveRequestId: string | null
  isManuallyUpdated: boolean
  /** Payroll has used the day: it can no longer be edited. */
  isFrozen: boolean
  comments: string | null
  processedAt: string | null
  flags: DayFlag[]
  /** Warnings raised on the day and the heaviest penalty among them. */
  warningCount: number
  penaltyType: string | null
  penaltyPercentage: number | null
  clockInStatus: PunchStatus | null
  clockOutStatus: PunchStatus | null
  rowVersion: string
}

export type TimeSheetData = Paginated<TimeSheetDay>

/** Totals of `/time-sheet/summary` (and `/overview/summary`): the "Days Overview" tiles. */
export interface DaysOverview {
  fromDate: string
  toDate: string
  totalDays: number
  employees: number
  present: number
  absent: number
  holiday: number
  weekend: number
  restDay: number
  leave: number
  halfDay: number
  shortDay: number
  wfh: number
  officialVisit: number
  sandwich: number
  yetToStart: number
  lateArrival: number
  earlyLeft: number
  missingPunch: number
  workedMinutes: number
  overtimeMinutes: number
  approvedOvertimeMinutes: number
}

export interface OverviewTotals {
  totalDays: number
  present: number
  absent: number
  holiday: number
  daysOff: number
  leave: number
  lateArrival: number
  earlyLeft: number
}

export interface OverviewRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  designationName: string | null
  employeeStatus: string | null
  totals: OverviewTotals
  /** `yyyy-MM-dd` → day state; days not processed are missing. */
  days: Record<string, DayStatus>
}

export interface OverviewPage extends Paginated<OverviewRow> {
  /** Every day of the month, `yyyy-MM-dd`. */
  days: string[]
}

/** A flag of the day with its minutes (late 12, overtime 30…). */
export interface DayFlagDetail {
  flag: DayFlag
  minutes: number | null
}

/** `GET /attendance/days/{employeeId}/{date}`. */
export interface DayDetail {
  day: TimeSheetDay
  flags: DayFlagDetail[]
  breaks: AttendanceBreak[]
  punches: PunchLog[]
}

/** One changed field of a day (`/days/{..}/history`). */
export interface HistoryEntry {
  id: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  actionName: string | null
  /** When it happened (ISO, with a zone once read). */
  performedAt: string | null
  performedByUserId: string | null
  performedByName: string | null
}

/** One punch (`PunchOut`): Attendance Logs rows and the day's Attendance Log. */
export interface PunchLog {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  punchedAt: LocalDateTime
  punchType: PunchType
  breakTypeId: string | null
  breakTypeName: string | null
  source: PunchSource
  deviceId: string | null
  deviceCode: string | null
  deviceName: string | null
  latitude: number | null
  longitude: number | null
  ipAddress: string | null
  photoFileId: string | null
  /** The clock-in photo (signed link, expires). */
  photo: FileRef | null
  requestId: string | null
  remarks: string | null
  isManuallyUpdated: boolean
  isIgnored: boolean
  /** Manual and imported punches can be edited or deleted; the others can only be ignored. */
  editable: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** The signed-in person's clock (`GET /attendance/clock`). */
export interface ClockState {
  /** Dashboard punch is on and the user is an employee. */
  allowed: boolean
  reason: string | null
  photoRequired: boolean
  locationRequired: boolean
  employeeId: string | null
  employeeName: string | null
  now: LocalDateTime
  clockedIn: boolean
  nextPunchType: PunchType
  lastPunchType: PunchType | null
  lastPunchedAt: LocalDateTime | null
  expectedIn: LocalDateTime | null
  expectedOut: LocalDateTime | null
}

/** Body of `POST /attendance/clock`. */
export interface ClockInput {
  punchType?: 'check_in' | 'check_out'
  source?: 'web' | 'mobile'
  latitude?: number
  longitude?: number
  /** An upload (`POST /files`, module attendance). */
  photoFileId?: string
}

export interface OverviewParams {
  scope: OverviewScope
  /** `yyyy-MM`. */
  month: string
  page: number
  pageSize: number
  search?: string
  /** `active` / `inactive`; omitted = everyone. */
  status?: string
  departmentId?: string
}

export interface TimeSheetParams {
  scope: TimeSheetScope
  employeeId?: string
  departmentId?: string
  from: string
  to: string
  page: number
  pageSize: number
  search?: string
  status?: string
  dayStatus?: DayStatus
  flag?: DayFlag
}

/** The "Days Overview This Month" request. */
export interface SummaryParams {
  scope: TimeSheetScope
  from: string
  to: string
  employeeId?: string
}

export interface DayKey {
  employeeId: string
  date: string
}

/** Body of `PUT /attendance/days/{employeeId}/{date}` (`DayEditIn`). */
export interface DayEditInput {
  /** Sent back unchanged: the API stores what it is given. */
  expectedIn: LocalDateTime | null
  expectedOut: LocalDateTime | null
  firstIn: LocalDateTime | null
  lastOut: LocalDateTime | null
  markedStatus: DayMark | null
  comments: string | null
  breaks: { breakTypeId: string | null; outAt: LocalDateTime; inAt: LocalDateTime | null }[]
  rowVersion: string
}

/** Body of `POST /attendance/time-sheet/process`. */
export interface ProcessInput {
  fromDate: string
  toDate: string
  employeeIds?: string[]
  overwriteManual?: boolean
}

export interface ProcessResult {
  processedDays: number
  employees: number
}

/** Legacy: Missing punches are punch requests now (requests module). */
export interface MissingPunchInput {
  type: 'check_in' | 'check_out'
  at: LocalDateTime
  reason: string
}

/** Legacy: Relaxation is a request now (requests module). */
export interface RelaxationInput {
  reason: string
}

/** Legacy: Absence as leave / visit / WFH is a request now (requests module). */
export interface AbsenceInput {
  markAs: AbsenceMark
  reason: string
}

/** Legacy: Overtime is a request now (requests module). */
export interface OvertimeInput {
  approvedMinutes: number
  reason: string
}

/** Legacy: The API gives `warningCount` and the penalty on each day instead. */
export interface WarningMark {
  percent: number
  penalty: string | null
}

/** Legacy: The API keeps one `comments` text per day (edited with the day). */
export interface AttendanceComment {
  id: string
  author: { id: string; name: string; code: string }
  text: string
  createdAt: string
}

/** Legacy: Pickers come from `/employees/lookup` and `/organisation/lookups/departments`. */
export interface AttendanceLookups {
  employees: AttendanceEmployee[]
  departments: string[]
}
