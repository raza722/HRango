import { useId } from 'react'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { amountText, viewDay } from './loan-advances.constants'
import type { LoanAdvancePayload } from './loan-advances.types'

/** A read-only amount with the grey "RS" box on its left, as the View popups draw it. */
export function LoanAmountRow({ label, amount }: { label: string; amount: number | null }) {
  const id = useId()
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span id={id} className="font-inter text-sm text-heading @xl:text-base">
        {label}
      </span>
      <span
        aria-labelledby={id}
        className="flex min-h-10 overflow-hidden rounded-md bg-[#D9D9D9]/60 font-inter text-sm text-field-value dark:bg-muted"
      >
        <span
          aria-hidden="true"
          className="flex items-center bg-[#D9D9D9] px-3 text-base text-grey dark:bg-muted-foreground/30"
        >
          RS
        </span>
        <span className="flex items-center px-4 py-2">
          {amount === null ? '—' : amountText(amount)}
        </span>
      </span>
    </div>
  )
}

/**
 * The request's fields in the View and Approve/Reject popups, in the drawn
 * order: Required Date, Required Loan & Advances Amount, Type, Category,
 * Attachment, Extension No. and Reason.
 */
export function LoanAdvancesDetail({ request }: { request: StandardRequest<LoanAdvancePayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Required Date" value={viewDay(payload.requiredDate)} />
      <LoanAmountRow label="Required Loan & Advances Amount" amount={payload.requiredAmount} />
      <StandardReadOnlyRow label="Loan & Advances Type" value={payload.typeName} />
      <StandardReadOnlyRow label="Loan & Advances Category" value={payload.categoryName} />
      <StandardReadOnlyRow label="Attachment" value={payload.attachment ?? '—'} />
      <StandardReadOnlyRow label="Extension No." value={payload.extensionNo || '—'} />
      <StandardReadOnlyRow label="Reason" value={payload.reason || '—'} multiline />
    </>
  )
}
