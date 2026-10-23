import { format, parse } from 'date-fns'

import { formatAmount } from '@/features/payroll'

import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import type { PromotionPayload } from './promotion.types'

const viewDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/** The request's fields in the Approve/Reject and approvals' View popups. */
export function PromotionDetail({ request }: { request: StandardRequest<PromotionPayload> }) {
  const { payload } = request
  return (
    <>
      <StandardReadOnlyRow label="Type" value={payload.demotion ? 'Demotion' : 'Promotion'} />
      <StandardReadOnlyRow label="Grade" value={payload.grade} />
      <StandardReadOnlyRow label="Level" value={payload.level} />
      <StandardReadOnlyRow label="Designation" value={payload.designation} />
      <StandardReadOnlyRow label="Job Title" value={payload.jobTitle} />
      <StandardReadOnlyRow
        label="Previous Salary (RS)"
        value={formatAmount(payload.previousSalary)}
      />
      <StandardReadOnlyRow label="Salary (RS)" value={formatAmount(payload.salary)} />
      <StandardReadOnlyRow
        label="Benefits"
        value={payload.benefitNames.length > 0 ? payload.benefitNames.join(', ') : '—'}
      />
      <StandardReadOnlyRow label="Effective Date" value={viewDay(payload.effectiveDate)} />
      <StandardReadOnlyRow label="Attachment" value={payload.attachment ?? '—'} />
      <StandardReadOnlyRow label="Description" value={payload.description || '—'} multiline />
    </>
  )
}
