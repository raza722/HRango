import { Link } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { Spinner } from '@/components/feedback/spinner'
import { cn } from '@/lib/utils'

import { BUDGET_STATUS_META } from '../../constants'
import { usePlan } from '../../hooks/use-manpower'
import { formatAmount, formatCount, stampOf } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { accent, headText } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

/**
 * The plan list's Approvals icon: each budget the plan asked for, its status and who
 * decided it. The decisions themselves are made on Budget Approvals.
 */
export function PlanApprovalsDialog({ planId, onClose }: { planId: string; onClose: () => void }) {
  const plan = usePlan(planId)
  return (
    <MpDialog
      title={plan.data ? `Approvals: ${plan.data.title}` : 'Approvals'}
      onClose={onClose}
      className="max-w-[47.3125rem]"
    >
      {plan.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading the approvals" />
        </div>
      ) : plan.isError ? (
        <ErrorState
          message="The plan's approvals could not be loaded."
          onRetry={() => void plan.refetch()}
          className="shadow-none"
        />
      ) : plan.data.budgets.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#707070]">
          This plan has no budgets waiting for approval.
        </p>
      ) : (
        <div className="grid gap-5">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Budgets of {plan.data.title}</caption>
              <thead>
                <tr className="border-y border-[#EBEFF8] dark:border-border">
                  {['Position', 'Budget', 'Positions', 'Status', 'Decided By'].map((head) => (
                    <th key={head} scope="col" className={cn('h-11 px-2 text-left', headText)}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.data.budgets.map((budget) => (
                  <tr key={budget.id}>
                    <td className="px-2 py-3 align-top text-heading">{budget.title}</td>
                    <td className="px-2 py-3 align-top text-heading">
                      {formatAmount(budget.amount)}
                    </td>
                    <td className="px-2 py-3 align-top text-heading">
                      {formatCount(budget.totalPositions)}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <Chip {...BUDGET_STATUS_META[budget.status]} size="sm" />
                    </td>
                    <td className="px-2 py-3 align-top">
                      {budget.decidedAt ? (
                        <StampCell
                          stamp={stampOf(budget.decidedAt, budget.decidedByName)}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-[#707070]">Awaiting approval</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            to="/manpower-planning/budget-approvals"
            className={cn(
              'justify-self-end text-sm font-medium underline-offset-4 hover:underline',
              accent.text,
            )}
          >
            Open Budget Approvals
          </Link>
        </div>
      )}
    </MpDialog>
  )
}
