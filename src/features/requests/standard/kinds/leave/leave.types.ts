/** A leave type's balance for one person this year. */
export interface LeaveBalance {
  /** The yearly entitlement ("Balance", "Total Leaves"). */
  total: number
  /** Approved days. */
  availed: number
  /** Days waiting for approval. */
  pending: number
  /** What is left to ask for: total − availed − pending. */
  available: number
}

export type ShortLeaveType = 'half-day' | 'quarter-day'

/** A Leave request: days off of one type, or part of one day ("Short"). */
export interface LeavePayload {
  leaveTypeId: string
  leaveTypeName: string
  short: boolean
  shortType: ShortLeaveType | null
  /** "Half Day". */
  shortTypeLabel: string | null
  /** The first and last day; the Request Date for a short leave. */
  from: string
  to: string
  /** Short leave only (`yyyy-MM-dd`, `HH:mm`). */
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  /** The days with a shift: the days counted. */
  dates: string[]
  /** Days taken (0.5 for a half day). */
  count: number
  rosterGroupId: string | null
  rosterTitle: string
  attachment: string | null
  reason: string
  /** The person's balance of this leave type now. */
  balance: LeaveBalance
}

export interface LeaveInput {
  employeeId?: string
  leaveTypeId: string
  short: boolean
  shortType: ShortLeaveType | null
  from: string
  to: string
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  attachment: string | null
  reason: string
}

export interface LeaveLookups {
  leaveTypes: { id: string; name: string }[]
  /** "Half Day" is half the day's shift. */
  shortTypes: { value: ShortLeaveType; label: string; fraction: number }[]
  /** Every person's balance, by employee id and leave type id. */
  balances: Record<string, Record<string, LeaveBalance>>
  /** Photos of the people who have one, for the shift strip. */
  photos: Record<string, string>
}
