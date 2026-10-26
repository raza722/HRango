/**
 * A Work From Home request's `details` (`GET /requests/work-from-home/{id}`):
 * the shift days asked from home. The dates and the count are the header's
 * `fromDate`, `toDate` and `days`; the reason is the header's `reason`.
 */
export interface WorkFromHomePayload {
  days: { requestDate: string; scheduleId: string | null }[]
}

/** What the form sends as `details`: the ticked days (empty: every shift day in the range). */
export interface WorkFromHomeDetailsIn {
  dates: string[]
}

/** A day in the week strip, read from Scheduling's board. */
export interface ShiftDay {
  date: string
  status: 'shift' | 'rest' | 'off'
  clockIn: string | null
  clockOut: string | null
  /** "10:00 AM - 05:00 PM", "Rest Day", a holiday's name or "Day off". */
  label: string
  /** The shift's time slot ("RS Morning"). */
  slotName: string | null
  /** Already a work-from-home day on the schedule. */
  workFromHome: boolean
}
