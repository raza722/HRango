import type { EnrollmentStatus, RosterDay } from './types/roster.types'

export const ROSTER_DAY_LABELS: Record<RosterDay, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Active',
  discontinued: 'Discontinued',
}

/** The API allows 200 characters. */
export const ROSTER_TITLE_MAX_LENGTH = 200
export const ROSTER_DESCRIPTION_MAX_LENGTH = 500

/** Rows per page of the roster and enrollment lists ("Show 10 entries"). */
export const ROSTER_PAGE_SIZE = 10

/** Date format of the enrollment table, as drawn: 16-Aug-2024. */
export const ENROLLMENT_DATE_FORMAT = 'dd-MMM-yyyy'

/** Permission codes (`backend/app/catalogue/roster.py`). */
export const ROSTER_PERMISSIONS = {
  groupsCreate: 'roster.groups.create',
  groupsEdit: 'roster.groups.edit',
  groupsDelete: 'roster.groups.delete',
  enrolmentsView: 'roster.enrolments.view',
  enrolmentsEnroll: 'roster.enrolments.enroll',
  enrolmentsEdit: 'roster.enrolments.edit',
  enrolmentsDelete: 'roster.enrolments.delete',
} as const
