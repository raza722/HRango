import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { RestDayPayload } from './rest-days.types'

const viewDay = (date: string | null) =>
  date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy') : '—'

/** The request's fields in the View and Approve/Reject popups, as drawn. */
export function RestDaysDetail({ request }: { request: StandardRequest<RestDayPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Employee Name" value={request.employee.name} />
      <StandardReadOnlyRow label="Department" value={payload.departmentName ?? '—'} />
      <StandardReadOnlyRow label="Roster" value={payload.rosterGroupName ?? '—'} />
      <StandardReadOnlyRow label="Date (from)" value={viewDay(request.fromDate)} />
      <StandardReadOnlyRow label="Date (to)" value={viewDay(request.toDate)} />
      <StandardReadOnlyRow
        label="Selected Days"
        value={String(request.days ?? payload.days.length)}
      />
      <StandardReadOnlyRow label="Payable" value={payload.isPayable ? 'Yes' : 'No'} />
      <StandardReadOnlyRow label="Reason" value={request.reason ?? '—'} multiline />
    </>
  )
}
