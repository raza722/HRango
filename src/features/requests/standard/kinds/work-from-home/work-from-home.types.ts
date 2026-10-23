/** A Work From Home request: the ticked shifts between two dates. */
export interface WorkFromHomePayload {
  from: string
  to: string
  /** The ticked shifts' days. */
  dates: string[]
  count: number
  reason: string
}

export interface WorkFromHomeInput {
  employeeId?: string
  from: string
  to: string
  dates: string[]
  reason: string
}

export interface WorkFromHomeLookups {
  /** Photos of the people who have one, for the week strip. */
  photos: Record<string, string>
}

/** A day in the week strip, from `GET /requests/<kind>/schedule`. */
export interface ShiftDay {
  date: string
  status: 'shift' | 'rest' | 'off'
  clockIn: string | null
  clockOut: string | null
  /** "10:00 AM - 05:00 PM", "Rest Day" or "Day off". */
  label: string
  rosterGroupId: string | null
  /** Already a work-from-home day on the schedule. */
  workFromHome: boolean
}
