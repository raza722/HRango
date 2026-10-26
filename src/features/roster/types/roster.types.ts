/**
 * Roster groups (`/api/roster/...`): a named weekly pattern (a time slot or a day off per
 * weekday) that employees are enrolled in for a period. Shapes follow the backend
 * (`backend/app/schemas/roster.py`); ids are strings, dates `yyyy-MM-dd`, times `HH:mm:ss`.
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

/** The API numbers weekdays 1 (Monday) … 7 (Sunday). */
export const weekdayNumber = (day: RosterDay): number => ROSTER_DAYS.indexOf(day) + 1
export const rosterDayOf = (weekday: number): RosterDay => ROSTER_DAYS[weekday - 1] ?? 'monday'

/** One weekday of a group, with the time slot it follows (null on a day off). */
export interface RosterGroupDay {
  /** 1 = Monday … 7 = Sunday. */
  weekday: number
  isDayOff: boolean
  timeSlotId: string | null
  timeSlotCode: string | null
  timeSlotName: string | null
  /** `HH:mm:ss`. */
  startTime: string | null
  endTime: string | null
  isOvernight: boolean | null
  durationMinutes: number | null
  workableMinutes: number | null
}

/** `GET /roster/groups/{id}`: always seven days, Monday first. */
export interface RosterGroupDetail {
  id: string
  title: string
  fromDate: string
  /** `null` = open-ended. */
  toDate: string | null
  description: string | null
  isActive: boolean
  /** Employees enrolled now or later (not discontinued). */
  enrolledCount: number
  /** On the list only. */
  workingDays: number | null
  /** On the single item only (empty on the list). */
  days: RosterGroupDay[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** A row of `GET /roster/groups` (same shape; `days` is empty, `workingDays` is set). */
export type RosterGroupRow = RosterGroupDetail

/** `POST` / `PUT /roster/groups`: a weekday left out of `days` is a day off. */
export interface RosterGroupInput {
  title: string
  fromDate: string
  toDate: string | null
  description: string | null
  isActive: boolean
  days: { weekday: number; isDayOff: boolean; timeSlotId: string | null }[]
  /** Edits send the version last read. */
  rowVersion?: string
}

export const ENROLLMENT_STATUSES = ['active', 'discontinued'] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

/** One enrolment (`EnrolmentOut`). */
export interface RosterEnrollment {
  id: string
  rosterGroupId: string
  rosterGroupTitle: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  designationName: string | null
  branchName: string | null
  /** `yyyy-MM-dd`. */
  startDate: string
  /** `yyyy-MM-dd`; `null` = open-ended. */
  endDate: string | null
  status: EnrollmentStatus
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** Enrolment list row: the API joins the names in already. */
export type RosterEnrollmentRow = RosterEnrollment

export interface EnrollmentListParams {
  status: EnrollmentStatus
  page: number
  pageSize: number
  search?: string
}

/** Someone who could be enrolled (`GET /employees/lookup`). */
export interface EnrollmentCandidate {
  id: string
  code: string
  name: string
  departmentName: string | null
  designationName: string | null
  branchName: string | null
  status: string
}

/** `POST /roster/groups/{id}/enrolments`. */
export interface EnrollmentInput {
  employeeIds: string[]
  startDate: string
  /** `null` = the group's end (or open-ended). */
  endDate: string | null
}

/**
 * A time slot to pick (`GET /scheduling/options/time-slots`). Lives here so Roster and
 * Scheduling share it without importing each other both ways.
 */
export interface TimeSlotOption {
  id: string
  name: string
  code: string | null
  /** `HH:mm:ss`. */
  startTime: string | null
  endTime: string | null
  isOvernight: boolean | null
  isFlexible: boolean | null
}

export * from './mock-store.types'
