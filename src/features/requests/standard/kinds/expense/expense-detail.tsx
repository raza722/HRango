import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { claimTableClass, money, viewDay, viewMonth } from './claims.utils'
import type { ExpensePayload } from './expense.types'

/**
 * The claims in the View and Approve popups: each claim's title, date,
 * category, amount, approved amount, receipt and the payroll month it is paid in.
 */
export function ExpenseDetail({ request }: { request: StandardRequest<ExpensePayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Claims" value={String(payload.lines.length)} />
      <StandardReadOnlyRow
        label="Total Amount"
        value={money(payload.totalAmount, payload.currency)}
      />
      <StandardReadOnlyRow
        label="Approved Amount"
        value={money(payload.approvedAmount, payload.currency)}
      />
      <div className="overflow-x-auto rounded-md">
        <table className={claimTableClass}>
          <caption className="sr-only">Expense claims</caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Date</th>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
              <th scope="col">Approved</th>
              <th scope="col">Receipt</th>
              <th scope="col">Paid In</th>
            </tr>
          </thead>
          <tbody>
            {payload.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td>
                  <span className="block font-medium text-person">{line.title}</span>
                  <span className="block">{line.description}</span>
                </td>
                <td className="whitespace-nowrap">{viewDay(line.claimDate)}</td>
                <td>{line.expenseCategoryName ?? '—'}</td>
                <td className="whitespace-nowrap">{money(line.amount, payload.currency)}</td>
                <td className="whitespace-nowrap">
                  {money(line.approvedAmount, payload.currency)}
                </td>
                <td>
                  {line.fileId && line.fileUrl ? (
                    <a
                      href={line.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {line.fileName ?? 'Receipt'}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="whitespace-nowrap">{viewMonth(line.paidInMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
