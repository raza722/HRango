import { useEffect } from 'react'

import { FormField } from '@/components/form'
import { RsInput } from '@/features/payroll'

import type { StandardDecisionFieldsProps } from '../../standard.types'
import { money, parseAmount, toAmount } from './claims.utils'
import type { ExpensePayload } from './expense.types'

interface LineApproval {
  id: string
  approvedAmount: number
}

const linesOf = (value: Record<string, unknown>): LineApproval[] =>
  Array.isArray(value.lines) ? (value.lines as LineApproval[]) : []

/**
 * "Approve & Forward": the approver may lower each claim (0 = not reimbursed,
 * never above the claim). Sent as `details.lines [{id, approvedAmount}]`;
 * claims nobody lowered are approved as claimed at the final approval.
 */
export function ExpenseDecisionFields({
  request,
  readOnly,
  value,
  onChange,
  errors,
}: StandardDecisionFieldsProps<ExpensePayload>) {
  const { payload } = request

  // Starts from each claim's amount (or what an earlier approver set).
  useEffect(() => {
    if (readOnly) return
    onChange({
      lines: payload.lines.map((line) => ({
        id: line.id,
        approvedAmount: toAmount(line.approvedAmount) ?? toAmount(line.amount) ?? 0,
      })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the popup opens
  }, [readOnly])

  if (readOnly) return null
  const current = linesOf(value)
  const overOf = (line: { id: string; amount: number | string }) => {
    const approved = current.find((item) => item.id === line.id)?.approvedAmount
    return approved !== undefined && approved > (toAmount(line.amount) ?? 0)
  }
  // The API's message for the lines shows only when no box already says what is wrong.
  const anyOver = payload.lines.some(overOf)
  const set = (id: string, text: string) => {
    const amount = parseAmount(text)
    onChange({
      lines: current.map((line) =>
        line.id === id ? { ...line, approvedAmount: amount ?? 0 } : line,
      ),
    })
  }
  return (
    <section aria-label="Approved amounts" className="grid gap-4">
      <h3 className="font-inter text-base font-semibold text-heading">Approved Amounts</h3>
      {errors.lines && !anyOver && (
        <p role="alert" className="text-xs text-destructive">
          {errors.lines}
        </p>
      )}
      {payload.lines.map((line) => {
        const approved = current.find((item) => item.id === line.id)?.approvedAmount
        return (
          <FormField
            key={line.id}
            label={`${line.title} (${money(line.amount, payload.currency)})`}
            error={
              overOf(line) ? (errors[`lines.${line.id}`] ?? 'Not more than the claim') : undefined
            }
          >
            {(a11y) => (
              <RsInput
                {...a11y}
                value={approved === undefined ? '' : String(approved)}
                onChange={(next) => {
                  set(line.id, next)
                }}
              />
            )}
          </FormField>
        )
      })}
    </section>
  )
}
