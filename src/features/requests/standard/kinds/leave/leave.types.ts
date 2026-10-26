/** `half_day` counts 0.5 of the day, `quarter_day` 0.25 (the API's values). */
export type ShortLeaveType = 'half_day' | 'quarter_day'

/**
 * A Leave request's `details` (`GET /requests/leave/{id}`). The dates are the
 * header's `fromDate` / `toDate` (one day for a short leave), the count its
 * `days`, the reason its `reason`, the files its `attachments`.
 */
export interface LeavePayload {
  leaveTypeId: string
  leaveTypeName: string | null
  isShort: boolean
  shortLeaveType: ShortLeaveType | null
  /** Short leave only, `HH:mm:ss` on the request's day. */
  startTime: string | null
  endTime: string | null
  /** The counted days (shift days, or the short leave's share of one). */
  days: number | null
}

/** What the form sends as `details`. */
export interface LeaveDetailsIn {
  leaveTypeId: string
  isShort: boolean
  shortLeaveType: ShortLeaveType | null
  startTime: string | null
  endTime: string | null
}

/**
 * A leave type the person may apply for, with their balance and the type's form rules
 * (`GET /requests/options/leave-types?employeeId=`, held with `requests.leave.create`).
 */
export interface LeaveTypeOption {
  id: string
  name: string
  code: string | null
  isDeductible: boolean
  /** It may be taken as part of a day (half day or quarter day). */
  isShortLeave: boolean
  /** "Half Day" is allowed for this person (type and their Half & Short policy). */
  allowHalfDay: boolean
  /** "Quarter Day" (short leave) is allowed. */
  allowShortLeave: boolean
  attachmentRequired: boolean
  /** Without the attachment: `refuse` (the API refuses) or `note` (accepted, marked). */
  attachmentRule: string
  allowBackDate: boolean
  /** How many days back (null: no limit) when back dates are allowed. */
  backDateLimitDays: number | null
  /** How many days ahead at most (null: no limit). */
  futureLimitDays: number | null
  entitled: number
  used: number
  pending: number
  available: number
}

/** One leave type's balance for one person (`GET /leaves/balances`). */
export interface LeaveBalance {
  leaveTypeId: string
  leaveTypeTitle: string
  /** The entitlement ("Balance", "Total Leaves"). */
  entitled: number
  /** Approved days ("Availed"). */
  used: number
  /** Days waiting for approval. */
  pending: number
  available: number
}

export interface LeaveLookups {
  /** "Half Day" is half the day's shift. */
  shortTypes: { value: ShortLeaveType; label: string; fraction: number }[]
}
