import { format, parse } from 'date-fns'

import type { StandardDecisionFieldsProps, StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { useScheduleDays } from '../work-from-home/schedule-days'
import { ShiftStrip } from '../work-from-home/shift-strip'
import { shortTypeLabel, useLeaveBalances } from './leave.lookups'
import type { LeavePayload } from './leave.types'

const viewDay = (date: string | null) =>
  date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy') : '—'
/** "09:00:00" → "09:00 AM". */
const viewTime = (time: string | null) =>
  time ? format(parse(time.slice(0, 5), 'HH:mm', new Date()), 'hh:mm a') : '—'
/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)

/**
 * The request's fields in the View and Approve/Reject popups (frame
 * 4194:71309): Leave Type, the dates (or the short leave's day and times),
 * the shift strip, Count and Reason.
 */
export function LeaveDetail({ request }: { request: StandardRequest<LeavePayload> }) {
  const { payload } = request
  const from = request.fromDate ?? ''
  const to = request.toDate ?? from
  const schedule = useScheduleDays('leave', request.employee.id, from, to)
  const shiftDays = new Set(
    (schedule.data?.days ?? []).filter((item) => item.status === 'shift').map((item) => item.date),
  )
  return (
    <>
      <StandardReadOnlyRow label="Leave Type" value={payload.leaveTypeName ?? '—'} />
      {payload.isShort ? (
        <>
          <StandardReadOnlyRow
            label="Short Leave Type"
            value={shortTypeLabel(payload.shortLeaveType) ?? '—'}
          />
          <StandardReadOnlyRow label="Request Date" value={viewDay(request.fromDate)} />
        </>
      ) : (
        <>
          <StandardReadOnlyRow label="Start Date" value={viewDay(request.fromDate)} />
          <StandardReadOnlyRow label="End Date" value={viewDay(request.toDate)} />
        </>
      )}
      <ShiftStrip
        label="Shifts of the leave"
        person={request.employee}
        days={schedule.data?.days}
        loading={schedule.isPending && schedule.fetchStatus !== 'idle'}
        selected={shiftDays}
      />
      {payload.isShort && (
        <>
          <StandardReadOnlyRow label="Start Time" value={viewTime(payload.startTime)} />
          <StandardReadOnlyRow label="End Time" value={viewTime(payload.endTime)} />
        </>
      )}
      <StandardReadOnlyRow label="Count" value={days(request.days ?? payload.days ?? 0)} />
      <StandardReadOnlyRow label="Reason" value={request.reason ?? '—'} multiline />
      {request.description && (
        <StandardReadOnlyRow label="Description" value={request.description} multiline />
      )}
    </>
  )
}

/**
 * Under "Approvals" the approver sees the person's balance of this leave
 * type (`GET /leaves/balances?employeeId`): Total, Available and Availed
 * Leaves (read only).
 */
export function LeaveBalanceFields({ request }: StandardDecisionFieldsProps<LeavePayload>) {
  const balances = useLeaveBalances(request.employee.id)
  const balance = balances.data?.find((row) => row.leaveTypeId === request.payload.leaveTypeId)
  const show = (value: number | undefined) =>
    value === undefined ? (balances.isPending ? '…' : '—') : days(value)
  return (
    <>
      <StandardReadOnlyRow label="Total Leaves" value={show(balance?.entitled)} />
      <StandardReadOnlyRow label="Available Leaves" value={show(balance?.available)} />
      <StandardReadOnlyRow label="Availed Leaves" value={show(balance?.used)} />
    </>
  )
}
