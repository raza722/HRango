import { format, parse } from 'date-fns'

import type { StandardDecisionFieldsProps, StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { useScheduleDays } from '../work-from-home/schedule-days'
import { ShiftStrip } from '../work-from-home/shift-strip'
import type { LeavePayload } from './leave.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')
const viewTime = (date: string | null, time: string | null) =>
  date && time
    ? format(parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()), 'MMMM d, yyyy hh:mm a')
    : '—'
/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)

/**
 * The request's fields in the View and Approve/Reject popups (frame
 * 4194:71309): Leave Type, the dates (or the short leave's day and times),
 * the shift strip with the days counted, Count and Reason.
 */
export function LeaveDetail({ request }: { request: StandardRequest<LeavePayload> }) {
  const { payload } = request
  const schedule = useScheduleDays('leave', request.employee.id, payload.from, payload.to)
  return (
    <>
      <StandardReadOnlyRow label="Leave Type" value={payload.leaveTypeName} />
      {payload.short ? (
        <>
          <StandardReadOnlyRow label="Short Leave Type" value={payload.shortTypeLabel ?? '—'} />
          <StandardReadOnlyRow label="Request Date" value={viewDay(payload.from)} />
        </>
      ) : (
        <>
          <StandardReadOnlyRow label="Start Date" value={viewDay(payload.from)} />
          <StandardReadOnlyRow label="End Date" value={viewDay(payload.to)} />
        </>
      )}
      <ShiftStrip
        label="Shifts of the leave"
        person={request.employee}
        days={schedule.data}
        loading={schedule.isPending}
        selected={new Set(payload.dates)}
      />
      {payload.short && (
        <>
          <StandardReadOnlyRow
            label="Start Time"
            value={viewTime(payload.startDate, payload.startTime)}
          />
          <StandardReadOnlyRow
            label="End Time"
            value={viewTime(payload.endDate, payload.endTime)}
          />
        </>
      )}
      <StandardReadOnlyRow label="Count" value={days(payload.count)} />
      {payload.attachment && <StandardReadOnlyRow label="Attachment" value={payload.attachment} />}
      <StandardReadOnlyRow label="Reason" value={payload.reason || '—'} multiline />
    </>
  )
}

/**
 * Under "Approvals" the approver sees the person's balance of this leave
 * type: Total Leaves, Available Leaves and Availed Leaves (read only).
 */
export function LeaveBalanceFields({ request }: StandardDecisionFieldsProps<LeavePayload>) {
  const { balance } = request.payload
  return (
    <>
      <StandardReadOnlyRow label="Total Leaves" value={days(balance.total)} />
      <StandardReadOnlyRow label="Available Leaves" value={days(balance.available)} />
      <StandardReadOnlyRow label="Availed Leaves" value={days(balance.availed)} />
    </>
  )
}
