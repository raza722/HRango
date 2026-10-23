/**
 * Roster groups: a named weekly shift pattern (clock in / clock out per day,
 * some days marked as weekend) that employees are enrolled in for a period.
 */

export const ROSTER_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export type RosterDay = (typeof ROSTER_DAYS)[number]

export interface RosterDaySchedule {
  day: RosterDay
  /** A day off: no clock in / clock out. */
  isWeekend: boolean
  /** `HH:mm` (24h); `null` on a weekend day. */
  clockIn: string | null
  /** `HH:mm`; earlier than `clockIn` means the shift ends the next day. */
  clockOut: string | null
}

interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface RosterGroup extends Timestamps {
  id: string
  title: string
  isActive: boolean
  /** Default times shown above the week (used by "Apply For All"). */
  clockIn: string | null
  clockOut: string | null
  /** The week follows the default times on every working day. */
  applyToAll: boolean
  /** Always seven entries, Monday first. */
  days: RosterDaySchedule[]
}

/** List row: the group plus how many employees are actively enrolled. */
export interface RosterGroupRow extends RosterGroup {
  enrolledCount: number
}

export type RosterGroupInput = Omit<RosterGroup, 'id' | 'createdAt' | 'updatedAt'>

export const ENROLLMENT_STATUSES = ['active', 'discontinued'] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

export interface RosterEnrollment extends Timestamps {
  id: string
  rosterGroupId: string
  employeeId: string
  /** `yyyy-MM-dd`. */
  startDate: string
  /** `yyyy-MM-dd`; `null` = open-ended. */
  endDate: string | null
  branchId: string | null
  status: EnrollmentStatus
}

/** Enrollment list row with the names the API joins in. */
export interface RosterEnrollmentRow extends RosterEnrollment {
  employeeName: string
  department: string
  designation: string
  branchName: string | null
  locationName: string | null
}

export const ENROLLMENT_SORT_KEYS = [
  'employeeName',
  'department',
  'designation',
  'startDate',
  'endDate',
] as const
export type EnrollmentSortKey = (typeof ENROLLMENT_SORT_KEYS)[number]

export type SortDirection = 'asc' | 'desc'

export interface EnrollmentListParams {
  status: EnrollmentStatus
  page: number
  pageSize: number
  search?: string
  sort?: EnrollmentSortKey
  order?: SortDirection
}

/** Someone who could be enrolled, with the roster they are on now (if any). */
export interface EnrollmentCandidate {
  id: string
  name: string
  department: string
  designation: string
  currentRoster: { id: string; title: string } | null
}

export interface EnrollmentInput {
  employeeIds: string[]
  startDate: string
  endDate: string | null
  branchId: string | null
}
