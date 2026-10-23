import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { RestDayPayload } from './rest-days.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/** The request's fields in the View and Approve/Reject popups, as drawn. */
export function RestDaysDetail({ request }: { request: StandardRequest<RestDayPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Employee Name" value={request.employee.name} />
      <StandardReadOnlyRow label="Department" value={payload.department} />
      <StandardReadOnlyRow label="Roster" value={`${payload.rosterTitle} · ${payload.shift}`} />
      <StandardReadOnlyRow label="Date (from)" value={viewDay(payload.from)} />
      <StandardReadOnlyRow label="Date (to)" value={viewDay(payload.to)} />
      <StandardReadOnlyRow label="Selected Days" value={String(payload.days)} />
      <StandardReadOnlyRow label="Description" value={payload.reason || '—'} multiline />
    </>
  )
}
