import { format, parse } from 'date-fns'

import { formatAmount } from '@/features/payroll'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { PromotionPayload } from './promotion.types'

const viewDay = (date: string | null) =>
  date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy') : '—'

/** The request's fields in the Approve/Reject and approvals' View popups. */
export function PromotionDetail({ request }: { request: StandardRequest<PromotionPayload> }) {
  const { payload } = request
  const benefits = payload.benefits.map((item) => item.payItemName ?? item.payItemId)
  return (
    <>
      <StandardReadOnlyRow label="Type" value={payload.isDemotion ? 'Demotion' : 'Promotion'} />
      <StandardReadOnlyRow label="Grade" value={payload.gradeName ?? '—'} />
      <StandardReadOnlyRow label="Level" value={payload.jobLevelName ?? '—'} />
      <StandardReadOnlyRow label="Designation" value={payload.designationName ?? '—'} />
      <StandardReadOnlyRow label="Job Title" value={payload.jobTitleName ?? '—'} />
      <StandardReadOnlyRow
        label="Previous Salary (RS)"
        value={payload.previousSalary === null ? '—' : formatAmount(payload.previousSalary)}
      />
      <StandardReadOnlyRow label="Salary (RS)" value={formatAmount(payload.newSalary)} />
      <StandardReadOnlyRow
        label="Benefits"
        value={benefits.length > 0 ? benefits.join(', ') : '—'}
      />
      <StandardReadOnlyRow label="Effective Date" value={viewDay(payload.effectiveDate)} />
      <StandardReadOnlyRow label="Description" value={request.description ?? '—'} multiline />
    </>
  )
}
