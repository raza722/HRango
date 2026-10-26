import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { useScheduleDays } from './schedule-days'
import { ShiftStrip } from './shift-strip'
import type { WorkFromHomePayload } from './work-from-home.types'

const viewDay = (date: string | null) =>
  date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy') : '—'

/** The request's fields in the View and Approve/Reject popups: dates, the strip, the count. */
export function WorkFromHomeDetail({ request }: { request: StandardRequest<WorkFromHomePayload> }) {
  const from = request.fromDate ?? ''
  const to = request.toDate ?? from
  const schedule = useScheduleDays('work-from-home', request.employee.id, from, to)
  const dates = request.payload.days.map((item) => item.requestDate)
  return (
    <>
      <StandardReadOnlyRow label="Start Date" value={viewDay(request.fromDate)} />
      <StandardReadOnlyRow label="End Date" value={viewDay(request.toDate)} />
      <ShiftStrip
        label="Shifts from home"
        person={request.employee}
        days={schedule.data?.days}
        loading={schedule.isPending && schedule.fetchStatus !== 'idle'}
        selected={new Set(dates)}
      />
      <StandardReadOnlyRow label="Selected Days" value={String(request.days ?? dates.length)} />
      <StandardReadOnlyRow label="Reason" value={request.reason ?? '—'} multiline />
      {request.description && (
        <StandardReadOnlyRow label="Description" value={request.description} multiline />
      )}
    </>
  )
}
