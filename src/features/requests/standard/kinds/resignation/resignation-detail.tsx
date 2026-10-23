import { format, parse } from 'date-fns'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { ResignationPayload } from './resignation.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/**
 * The request's fields in the View and Approve/Reject popups. A cancellation
 * adds "Cancel Request" with the Reason for Cancellation, as the
 * Cancellations frames draw it.
 */
export function ResignationDetail({ request }: { request: StandardRequest<ResignationPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Type" value={payload.typeLabel} />
      <StandardReadOnlyRow label="Resignation Date" value={viewDay(payload.resignationDate)} />
      <StandardReadOnlyRow label="Last Working Date" value={viewDay(payload.lastWorkingDate)} />
      <StandardReadOnlyRow label="Notice Period" value={payload.noticePeriod} />
      <StandardReadOnlyRow label="Reason" value={payload.reason || '—'} multiline />
      <StandardReadOnlyRow label="Attachment" value={payload.attachmentName ?? '—'} />
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
