import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { BEN_CODES, categoryMeta, PLAN_STATUS } from '../../constants'
import { useDeletePlan, useDuplicatePlan, usePlans } from '../../hooks/use-benefits'
import type { BenefitPlan } from '../../types/benefits.types'
import { formatLongDay } from '../../utils/format'
import { PlanCopyIcon, PlanDeleteIcon } from '../shared/benefit-icons'
import { ruledRows, tableClass } from '../shared/benefit-styles'
import { DeleteConfirm } from '../shared/dialogs'
import { Chip, EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'
import { AddPlanMenu } from './add-plan-menu'

const routeApi = getRouteApi('/_app/benefits/plans/')

const iconButton =
  'flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:opacity-50'

const columns: DataTableColumn<BenefitPlan>[] = [
  {
    id: 'category',
    header: 'Category',
    cell: (row) => <span className="font-medium">{categoryMeta(row.category).label}</span>,
  },
  { id: 'name', header: 'Plan Name', mobile: 'heading', cell: (row) => row.name },
  { id: 'end', header: 'End Date', cell: (row) => formatLongDay(row.endDate) },
  {
    id: 'carrier',
    header: 'Carrier',
    cell: (row) => [row.carrier, row.planType].filter(Boolean).join(' · ') || '—',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <Chip meta={PLAN_STATUS[row.status]} className="-my-1" />,
  },
  {
    id: 'elections',
    header: 'Elections',
    cell: (row) => `${String(row.enrolled)} enrolled, ${String(row.pending)} pending`,
  },
]

/** People have elected the plan (approved or waiting): the API keeps it. */
const inUse = (row: BenefitPlan) => row.enrolled + row.pending > 0

const inUseReason = (row: BenefitPlan) => {
  const people = row.enrolled + row.pending
  return `${row.name} cannot be deleted: ${String(people)} ${people === 1 ? 'person has' : 'people have'} elected it.`
}

/**
 * Plans: "Benefit Plans" with + Add New Plan (the category menu); Category, Plan Name, End Date,
 * Eligible, Status (enrolled, not enrolled / waived) and the copy and delete icons.
 */
export function PlansPage() {
  const { year } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const list = usePlans({ year })
  const duplicate = useDuplicatePlan()
  const remove = useDeletePlan()
  const canCreate = useCan(BEN_CODES.planCreate)
  const canDelete = useCan(BEN_CODES.planDelete)
  const [deleting, setDeleting] = useState<BenefitPlan | null>(null)
  const fail = (fallback: string) => (error: Error) => {
    toast.error(error instanceof ApiError ? error.message : fallback)
  }

  return (
    <BenefitsPage
      tab="plans"
      title="Benefit Plans"
      year={year}
      onYearChange={(next) => {
        void navigate({ search: { year: next } })
      }}
      actions={canCreate ? <AddPlanMenu /> : undefined}
    >
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Benefit plans"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={3}
          className={cn(tableClass, ruledRows)}
          emptyState={
            <EmptyList>
              {year
                ? 'This plan year offers no plans yet. Choose them in Edit Plan Year.'
                : 'There are no plans yet. Add the first one with Add New Plan.'}
            </EmptyList>
          }
          rowActionsHeader="Action"
          rowActions={
            canCreate || canDelete
              ? (row) => (
                  <div className="-my-1 flex items-center gap-3">
                    {canCreate && (
                      <button
                        type="button"
                        aria-label={`Duplicate ${row.name}`}
                        disabled={duplicate.isPending}
                        onClick={() => {
                          duplicate.mutate(row.id, { onError: fail('Could not copy the plan.') })
                        }}
                        className={cn(iconButton, 'text-[#FD9317]')}
                      >
                        <PlanCopyIcon className="h-[1.3125rem] w-[1.125rem]" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Delete ${row.name}`}
                        // A plan people have elected stays: say so before any confirm.
                        aria-disabled={inUse(row) || undefined}
                        title={inUse(row) ? inUseReason(row) : undefined}
                        onClick={() => {
                          if (inUse(row)) toast.error(inUseReason(row))
                          else setDeleting(row)
                        }}
                        className={cn(
                          iconButton,
                          'text-[#C2420B]',
                          inUse(row) && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <PlanDeleteIcon className="h-[1.055rem] w-[0.9375rem]" />
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      )}
      <DeleteConfirm
        open={deleting !== null}
        title="Delete Plan"
        question={deleting ? `Are you sure you want to Delete “${deleting.name}” plan?` : ''}
        confirmLabel="Delete Plan"
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null)
        }}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting, {
            onSuccess: () => {
              setDeleting(null)
            },
            onError: (error) => {
              setDeleting(null)
              fail('Could not delete the plan.')(error)
            },
          })
        }}
      />
    </BenefitsPage>
  )
}
