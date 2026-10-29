import type { LeaveStatus, ShortLeaveType } from '@/features/leaves/types/leaves.types'

import type { StoredStandardRequest } from '../requests/standard/engine'
import type { LeaveStored } from '../requests/standard/kinds/leave'

/*
 * The leave requests, as the Leaves mock reads them. There is one store, as on the backend:
 * the Requests module's leave requests (`/requests/leave…`, `src/mocks/requests/standard`),
 * which Apply, Cancel and Approve/Reject write. My Leaves, Leave Applications, the balances
 * and the ledger read them here, so both modules show the same requests and balances.
 *
 * The Requests mock binds its table when it builds its handlers (`bindLeaveRequestSource`);
 * this module imports nothing at run time, so the two mocks do not import each other.
 */

/** A leave request in the Leaves module's terms (`LeaveApplicationOut` without the names). */
export interface LeaveRequestRow {
  id: string
  code: string
  status: LeaveStatus
  employeeId: string
  leaveTypeId: string
  fromDate: string
  toDate: string
  /** The days taken: the working days, or a short leave's share of one day. */
  days: number
  isShort: boolean
  shortLeaveType: ShortLeaveType | null
  /** `HH:mm:ss` for a short leave. */
  startTime: string | null
  endTime: string | null
  reason: string | null
  submittedAt: string
  decidedAt: string | null
  cancelReason: string | null
  createdAt: string
}

let source: () => readonly StoredStandardRequest[] = () => []

/** Called by the Requests mock with a reader of its leave requests. */
export function bindLeaveRequestSource(read: () => readonly StoredStandardRequest[]): void {
  source = read
}

/** The requests module's statuses → the Leaves module's (`completed` is `approved`). */
const statusOf = (status: StoredStandardRequest['status']): LeaveStatus =>
  status === 'completed' ? 'approved' : status

const seconds = (time: string | null) => (time ? `${time}:00` : null)

function toRow(record: StoredStandardRequest): LeaveRequestRow {
  const payload = record.payload as unknown as LeaveStored
  return {
    id: record.id,
    code: record.code,
    status: statusOf(record.status),
    employeeId: record.employeeId,
    leaveTypeId: payload.leaveTypeId,
    fromDate: payload.from,
    toDate: payload.to,
    days: payload.count,
    isShort: payload.short,
    shortLeaveType:
      payload.shortType === 'quarter-day'
        ? 'quarter_day'
        : payload.shortType === 'half-day'
          ? 'half_day'
          : null,
    startTime: payload.short ? seconds(payload.startTime) : null,
    endTime: payload.short ? seconds(payload.endTime) : null,
    reason: payload.reason || null,
    submittedAt: record.createdAt,
    decidedAt: record.status === 'pending' ? null : (record.history.at(-1)?.at ?? record.updatedAt),
    cancelReason: record.cancelReason,
    createdAt: record.createdAt,
  }
}

/** Every leave request, newest first. */
export function leaveRequestRows(): LeaveRequestRow[] {
  return source()
    .filter((record) => record.kind === 'leave')
    .map(toRow)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function leaveRequestRow(id: string): LeaveRequestRow | undefined {
  const record = source().find((item) => item.id === id && item.kind === 'leave')
  return record ? toRow(record) : undefined
}
