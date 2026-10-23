import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { useScheduleDays } from './schedule-days'
import { ShiftStrip } from './shift-strip'
import type { WorkFromHomePayload } from './work-from-home.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/** The request's fields in the View and Approve/Reject popups: dates, the strip, the count. */
export function WorkFromHomeDetail({ request }: { request: StandardRequest<WorkFromHomePayload> }) {
  const { payload } = request
  const schedule = useScheduleDays('work-from-home', request.employee.id, payload.from, payload.to)
  return (
    <>
      <StandardReadOnlyRow label="Start Date" value={viewDay(payload.from)} />
      <StandardReadOnlyRow label="End Date" value={viewDay(payload.to)} />
      <ShiftStrip
        label="Shifts from home"
        person={request.employee}
        days={schedule.data}
        loading={schedule.isPending}
        selected={new Set(payload.dates)}
      />
      <StandardReadOnlyRow label="Selected Days" value={String(payload.count)} />
      <StandardReadOnlyRow label="Reason" value={payload.reason || '—'} multiline />
    </>
  )
}
