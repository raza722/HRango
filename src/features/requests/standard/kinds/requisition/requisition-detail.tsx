import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { claimTableClass, money, viewDay } from '../expense/claims.utils'
import { REQUISITION_TYPE_LABELS } from './requisition.constants'
import type { RequisitionPayload } from './requisition.types'

const quantity = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

/** The requisition's fields and items in the View and Approve popups. */
export function RequisitionDetail({ request }: { request: StandardRequest<RequisitionPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Title" value={payload.title} />
      <StandardReadOnlyRow label="Type" value={REQUISITION_TYPE_LABELS[payload.requisitionType]} />
      <StandardReadOnlyRow label="Needed By" value={viewDay(payload.neededByDate)} />
      <StandardReadOnlyRow label="Delivery Location" value={payload.deliveryLocation ?? '—'} />
      <StandardReadOnlyRow
        label="Estimated Amount"
        value={money(payload.estimatedAmount, payload.currency)}
      />
      <div className="overflow-x-auto rounded-md">
        <table className={claimTableClass}>
          <caption className="sr-only">Items</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Quantity</th>
              <th scope="col">Unit</th>
              <th scope="col">Estimated Unit Cost</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {payload.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="font-medium text-person">{line.itemName}</td>
                <td>{quantity(line.quantity)}</td>
                <td>{line.unit ?? '—'}</td>
                <td className="whitespace-nowrap">
                  {money(line.estimatedUnitCost, payload.currency)}
                </td>
                <td>{line.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StandardReadOnlyRow label="Justification" value={request.reason ?? '—'} multiline />
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
