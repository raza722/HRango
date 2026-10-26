import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { money, viewDay, viewMonth } from '../expense/claims.utils'
import type { AirTicketPayload } from './air-tickets.types'

/** The claim's fields in the View and Approve popups. */
export function AirTicketsDetail({ request }: { request: StandardRequest<AirTicketPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Title" value={payload.title} />
      <StandardReadOnlyRow label="Claim Date" value={viewDay(payload.claimDate)} />
      <StandardReadOnlyRow label="Travel Date" value={viewDay(payload.travelDate)} />
      <StandardReadOnlyRow
        label="From / To"
        value={`${payload.fromPlace ?? '—'} → ${payload.toPlace ?? '—'}`}
      />
      <StandardReadOnlyRow label="Amount" value={money(payload.amount, payload.currency)} />
      <StandardReadOnlyRow
        label="Approved Amount"
        value={money(payload.approvedAmount, payload.currency)}
      />
      <StandardReadOnlyRow label="Paid In" value={viewMonth(payload.paidInMonth)} />
      <StandardReadOnlyRow label="Description" value={payload.description ?? '—'} multiline />
      <StandardReadOnlyRow
        label="Ticket"
        value={
          payload.fileId && payload.fileUrl ? (
            <a
              href={payload.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {payload.fileName ?? 'Ticket'}
            </a>
          ) : (
            '—'
          )
        }
      />
      {request.cancelReason && (
        <StandardReadOnlyRow
          label="Reason for Cancellation"
          value={request.cancelReason}
          multiline
        />
      )}
    </>
  )
}
