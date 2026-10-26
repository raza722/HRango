import { useEffect } from 'react'

import { FieldLayoutContext, FormField } from '@/components/form'
import { dialogFieldType, RsInput } from '@/features/payroll'

import type { StandardDecisionFieldsProps } from '../../standard.types'
import { parseAmount, toAmount } from '../expense/claims.utils'
import type { AirTicketPayload } from './air-tickets.types'

/** The approver may lower the claim (`details.approvedAmount`, never above the amount). */
export function AirTicketsDecisionFields({
  request,
  readOnly,
  value,
  onChange,
  errors,
}: StandardDecisionFieldsProps<AirTicketPayload>) {
  const { payload } = request
  useEffect(() => {
    if (readOnly) return
    onChange({ approvedAmount: toAmount(payload.approvedAmount) ?? toAmount(payload.amount) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the popup opens
  }, [readOnly])
  if (readOnly) return null
  const approved = typeof value.approvedAmount === 'number' ? value.approvedAmount : null
  const over = approved !== null && approved > (toAmount(payload.amount) ?? 0)
  return (
    <FieldLayoutContext value="horizontal">
      <div className={`grid gap-6 ${dialogFieldType}`}>
        <FormField
          label="Approved Amount"
          required
          error={over ? 'Not more than the claim' : errors.approvedAmount}
        >
          {(a11y) => (
            <RsInput
              {...a11y}
              value={approved === null ? '' : String(approved)}
              onChange={(next) => {
                onChange({ approvedAmount: parseAmount(next) })
              }}
            />
          )}
        </FormField>
      </div>
    </FieldLayoutContext>
  )
}
