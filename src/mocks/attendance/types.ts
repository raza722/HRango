/**
 * The mock attendance engine's own shapes. The engine (and the other mocks that read it:
 * requests, payroll, assets, leaves) keep working in these; the handlers translate them into the
 * backend's shapes (`backend.ts`), which are what the Attendance feature now uses.
 */

/** `yyyy-MM-ddTHH:mm`, the clock on the office wall. */
export type LocalDateTime = string

/** Day states the engine produces (the old 21-state legend). */
export type DayStatus =
  | 'present'
  | 'absent'
  | 'holiday'
  | 'half-day'
  | 'short-day'
  | 'leave'
  | 'half-leave'
  | 'short-leave'
  | 'sandwich'
  | 'official-visit'
  | 'leave-applied'
  | 'yet-to-start'
  | 'weekend'
  | 'workable-shifts'
  | 'workable-hours'
  | 'late-arrival'
  | 'early-left'
  | 'rest-day'
  | 'relaxation'
  | 'official-duty'
  | 'wfh'

export type PunchStatus = 'present' | 'late-arrival' | 'early-left' | 'missing-punch' | 'absent'

export type PunchType = 'check-in' | 'check-out' | 'break-out' | 'break-in'

export type PunchSource = 'machine' | 'manual' | 'dashboard' | 'request' | 'import'

export interface AttendanceEmployee {
  id: string
  code: string
  name: string
  department: string
  designation: string
  status: 'active' | 'inactive'
}

/** A person as other mocks (requests, payroll, assets) show them. */
export interface AttendanceProfile extends AttendanceEmployee {
  location: string | null
  branch: string | null
  company: string | null
  joiningDate: string
  photoUrl: string | null
}

export interface AttendanceBreak {
  /** Break type id (Settings → Break Types). */
  type: string
  outAt: LocalDateTime
  inAt: LocalDateTime | null
  description: string
}

export interface WarningMark {
  percent: number
  penalty: string | null
}

export interface TimeSheetDay {
  employeeId: string
  date: string
  slotName: string | null
  /** `HH:mm`. */
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
  overtimeMinutes: number
  approvedOvertimeMinutes: number | null
  warning: WarningMark | null
  status: DayStatus | null
  manuallyUpdated: boolean
  relaxed: boolean
}

export interface DaysOverview {
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

export interface AttendanceComment {
  id: string
  author: { id: string; name: string; code: string }
  text: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  editedBy: { id: string; name: string; code: string }
  action: string
  detail: string | null
  at: string
}

export interface PunchLog {
  id: string
  type: PunchType
  at: LocalDateTime
  description: string
  source: PunchSource
  machineId: string | null
  manuallyUpdated: boolean
}

/** A late arrival within this many minutes still counts as on time. */
export const GRACE_MINUTES = 5
/** Overtime starts counting after this many minutes past the clock out. */
export const OVERTIME_THRESHOLD_MINUTES = 15
/** Warnings in a month that make one penalty. */
export const WARNING_LIMIT = 5

/** Days that count as worked. */
export const PRESENT_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'present',
  'late-arrival',
  'early-left',
  'relaxation',
  'wfh',
  'workable-shifts',
  'workable-hours',
  'half-day',
  'short-day',
  'half-leave',
  'short-leave',
  'official-visit',
  'official-duty',
])

/** Days with nothing to clock. */
export const OFF_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'holiday',
  'weekend',
  'rest-day',
  'sandwich',
])
