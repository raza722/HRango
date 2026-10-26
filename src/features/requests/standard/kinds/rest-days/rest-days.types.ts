/**
 * A Rest Day request's `details` (`GET /requests/rest-day/{id}`): the roster
 * and department, whether the days are paid, and the days counted (the
 * person's shift days between the header's `fromDate` and `toDate`, or every
 * day when they have no schedule). The reason is the header's `reason`.
 */
export interface RestDayPayload {
  departmentId: string
  departmentName: string | null
  rosterGroupId: string
  rosterGroupName: string | null
  isPayable: boolean
  days: { requestDate: string; scheduleId: string | null }[]
}

/** What the form sends as `details`. */
export interface RestDayDetailsIn {
  departmentId: string | null
  rosterGroupId: string
  isPayable: boolean
}

/** A roster (`GET /scheduling/options/roster-groups`). */
export interface RosterOption {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
}

export interface RestDayLookups {
  rosters: RosterOption[]
}
