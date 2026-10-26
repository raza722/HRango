import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { RESIGNATION_TYPE_LABELS } from './resignation.lookups'
import type { ResignationPayload } from './resignation.types'
import { noticePeriod } from './resignation.utils'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const viewDay = (date: string | null) => (date ? format(day(date), 'MMMM d, yyyy') : '—')

/**
 * The request's fields in the View and Approve/Reject popups. A cancellation
 * adds "Cancel Request" with the Reason for Cancellation, as the
 * Cancellations frames draw it.
 */
export function ResignationDetail({ request }: { request: StandardRequest<ResignationPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Type" value={RESIGNATION_TYPE_LABELS[payload.resignationType]} />
      <StandardReadOnlyRow label="Resignation Date" value={viewDay(payload.resignationDate)} />
      <StandardReadOnlyRow label="Last Working Date" value={viewDay(payload.lastWorkingDate)} />
      <StandardReadOnlyRow label="Notice Period" value={noticePeriod(payload)} />
      <StandardReadOnlyRow label="Serve Notice" value={payload.serveNotice ? 'Yes' : 'No'} />
      <StandardReadOnlyRow label="Reason" value={request.reason ?? '—'} multiline />
      {request.cancelReason && (
        <>
          <h3 className="font-inter text-base font-semibold text-heading">Cancel Request</h3>
          <StandardReadOnlyRow
            label="Reason for Cancellation"
            value={request.cancelReason}
            multiline
          />
        </>
      )}
    </>
  )
}
