/** A Rest Days request: days off on the roster's working days between two dates. */
export interface RestDayPayload {
  department: string
  rosterGroupId: string
  rosterTitle: string
  /** "Morning Shift (10:00 am - 05:00 pm)". */
  shift: string
  /** "10:00 AM - 05:00 PM": the roster's day. */
  time: string
  /** "7h : 00m": one day of the roster. */
  duration: string
  from: string
  to: string
  /** The working days asked off. */
  dates: string[]
  days: number
  payable: boolean
  reason: string
}

export interface RestDayInput {
  employeeId?: string
  department: string
  rosterGroupId: string
  from: string
  to: string
  reason: string
}

export interface RestDayLookups {
  /** Working days are the roster's full lower-case weekday names ("monday" …). */
  rosters: { id: string; title: string; shift: string; workingDays: string[] }[]
  /** Each person's current roster. */
  rosterOf: Record<string, string | null>
}
