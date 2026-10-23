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

export const ROSTER_TITLE_MAX_LENGTH = 60

/** Rows per page of the roster and enrollment lists ("Show 10 entries"). */
export const ROSTER_PAGE_SIZE = 10

/** Date format of the enrollment table, as drawn: 16-Aug-2024. */
export const ENROLLMENT_DATE_FORMAT = 'dd-MMM-yyyy'
