import { format, parse } from 'date-fns'

import { clock } from '../../../utils/request-format'
import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { RelaxationPayload } from './relaxation.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/** The request's fields in the View and Approve/Reject popups. */
export function RelaxationDetail({ request }: { request: StandardRequest<RelaxationPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Time Slot" value={payload.timeSlot} />
      <StandardReadOnlyRow label="Date" value={viewDay(payload.date)} />
      <StandardReadOnlyRow label="Start Time" value={clock(payload.startTime)} />
      <StandardReadOnlyRow label="End Time" value={clock(payload.endTime)} />
      <StandardReadOnlyRow label="Duration" value={payload.duration} />
      <StandardReadOnlyRow label="Reason" value={payload.reason || '—'} multiline />
    </>
  )
}
