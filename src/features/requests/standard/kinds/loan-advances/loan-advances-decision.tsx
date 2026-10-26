import { useEffect, useState } from 'react'
import { addMonths, format, parse, startOfMonth } from 'date-fns'

import { FieldLayoutContext, FormField } from '@/components/form'
import { DateInput, dialogFieldType, RsInput, SearchSelect } from '@/features/payroll'

import type { StandardDecisionFieldsProps } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { amount, useLoanSummary } from './loan-advances.api'
import { amountText, PAYMENT_METHOD_LABELS, pkr, viewDay } from './loan-advances.constants'
import type { LoanAdvancePayload, LoanPaymentMethod } from './loan-advances.types'
import { LoanAmountRow } from './loan-advances-detail'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** The 1st of the month after the money is needed (or after today). */
function defaultRepaymentDate(requiredDate: string | null): string {
  const now = format(new Date(), 'yyyy-MM-dd')
  const from = requiredDate && requiredDate > now ? requiredDate : now
  return format(startOfMonth(addMonths(day(from), 1)), 'yyyy-MM-dd')
}

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as LoanPaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const plain = (value: string) => Number(value.replace(/,/g, ''))

/** "Guarantors": each one's Name, Relationship, Known Since and file, as drawn. */
function Guarantors({ payload }: { payload: LoanAdvancePayload }) {
  if (payload.guarantors.length === 0) return null
  const many = payload.guarantors.length > 1
  return (
    <section aria-label="Guarantors" className="grid gap-4">
      <h3 className="font-inter text-base font-semibold text-heading">Guarantors</h3>
      {payload.guarantors.map((guarantor, index) => (
        <div key={guarantor.id ?? `${guarantor.cnic}-${String(index)}`} className="grid gap-3">
          {many && (
            <p className="font-inter text-sm font-medium text-heading">
              Guarantor {String(index + 1)}
            </p>
          )}
          <StandardReadOnlyRow label="Name" value={guarantor.name} />
          <StandardReadOnlyRow label="Relationship" value={guarantor.relationship} />
          <StandardReadOnlyRow label="Known Since" value={viewDay(guarantor.knownSince)} />
          {guarantor.fileUrl && (
            <StandardReadOnlyRow
              label="Attachment"
              value={
                <a
                  href={guarantor.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary underline-offset-2 hover:underline"
                >
                  {guarantor.fileName ?? 'File'}
                </a>
              }
            />
          )}
        </div>
      ))}
    </section>
  )
}

/** The person's approved loans so far (`GET /loans/summary`; needs loans.loans.view). */
function Totals({ employeeId }: { employeeId: string }) {
  const summary = useLoanSummary(employeeId, true)
  if (!summary.data) return null
  return (
    <>
      <StandardReadOnlyRow
        label="Total Approved Requests Amount"
        value={pkr(amount(summary.data.totalApproved) ?? 0)}
      />
      <StandardReadOnlyRow
        label="Total Repaid Requests Amount"
        value={pkr(amount(summary.data.totalRepaid) ?? 0)}
      />
      <StandardReadOnlyRow
        label="Total Remaining Requests Amount"
        value={pkr(amount(summary.data.totalRemaining) ?? 0)}
      />
    </>
  )
}

/**
 * The approver's part of the popup: the guarantors, then (Approve/Reject
 * only) the person's three totals, Currency, Approved Amount, Payment Method
 * and Repayment Date: the API's `details` of the approval (approvedAmount,
 * paymentMethod, repaymentDate). View shows what was approved, read-only.
 */
export function LoanAdvancesDecisionFields({
  request,
  readOnly,
  value,
  onChange,
  errors,
}: StandardDecisionFieldsProps<LoanAdvancePayload>) {
  const { payload } = request
  const [amountBox, setAmountBox] = useState(
    amountText(payload.approvedAmount ?? payload.amountRequested),
  )

  // The popup starts from the amount asked (or an earlier approver's choices).
  useEffect(() => {
    if (readOnly) return
    onChange({
      approvedAmount: payload.approvedAmount ?? payload.amountRequested,
      paymentMethod: payload.paymentMethod,
      repaymentDate: payload.repaymentDate ?? defaultRepaymentDate(payload.requiredDate),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the popup opens
  }, [readOnly])

  const currency = payload.currency ?? 'Company currency'
  if (readOnly) {
    return (
      <>
        <Guarantors payload={payload} />
        <div className="grid gap-6">
          <StandardReadOnlyRow label="Currency" value={currency} />
          <LoanAmountRow label="Approved Amount" amount={payload.approvedAmount} />
          <StandardReadOnlyRow
            label="Payment Method"
            value={payload.paymentMethod ? PAYMENT_METHOD_LABELS[payload.paymentMethod] : '—'}
          />
          <StandardReadOnlyRow label="Repayment Date" value={viewDay(payload.repaymentDate)} />
        </div>
      </>
    )
  }

  const set = (key: string, next: unknown) => {
    onChange({ ...value, [key]: next })
  }
  return (
    <>
      <Guarantors payload={payload} />
      <div className="grid gap-6">
        <Totals employeeId={request.employee.id} />
        <StandardReadOnlyRow label="Currency" value={currency} />
      </div>
      <FieldLayoutContext value="horizontal">
        <div className={`grid gap-6 ${dialogFieldType}`}>
          <FormField label="Approved Amount" required error={errors.approvedAmount}>
            {(a11y) => (
              <RsInput
                {...a11y}
                value={amountBox}
                onChange={(next) => {
                  setAmountBox(next)
                  const number = plain(next)
                  set('approvedAmount', next.trim() && Number.isFinite(number) ? number : null)
                }}
              />
            )}
          </FormField>
          <FormField label="Payment Method" required error={errors.paymentMethod}>
            {(a11y) => (
              <SearchSelect
                id={a11y.id}
                value={text(value.paymentMethod) || null}
                onChange={(next) => {
                  set('paymentMethod', next)
                }}
                options={METHOD_OPTIONS}
                placeholder="Select Payment Method"
              />
            )}
          </FormField>
          <FormField label="Repayment Date" required error={errors.repaymentDate}>
            {(a11y) => (
              <DateInput
                id={a11y.id}
                value={text(value.repaymentDate)}
                onChange={(next) => {
                  set('repaymentDate', next)
                }}
                {...(payload.requiredDate ? { minDate: day(payload.requiredDate) } : {})}
              />
            )}
          </FormField>
        </div>
      </FieldLayoutContext>
    </>
  )
}
