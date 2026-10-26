import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { BEN_CODES, PLAN_YEAR_STATUS } from '../../constants'
import { useDeletePlanYear, usePlanYears } from '../../hooks/use-benefits'
import type { PlanYearStep } from '../../hooks/use-plan-year-wizard'
import type { PlanYear, PlanYearAction, WindowKind } from '../../types/benefits.types'
import { employeesCount, formatDuration } from '../../utils/format'
import { OpenEnrollmentDialog } from '../enrollment/open-enrollment-dialog'
import { AddIcon } from '../shared/benefit-icons'
import { accent, buttonClass, mediumText, plainRows, tableClass } from '../shared/benefit-styles'
import { DeleteConfirm } from '../shared/dialogs'
import { Chip, EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'
import { EditPlanYearDialog } from './edit-plan-year-dialog'
import { PlanYearRowMenu } from './plan-year-row-menu'

const routeApi = getRouteApi('/_app/benefits/plan-years/')

type Dialog =
  | { type: 'edit'; row: PlanYear; step: PlanYearStep }
  | { type: 'delete'; row: PlanYear }
  | { type: 'enroll'; row: PlanYear; name: string; kind: WindowKind }
  | null

/** "0 pending, 0 approved, 0 incomplete", the missing information line and its link. */
function ElectionsCell({ row }: { row: PlanYear }) {
  return (
    <div className="grid gap-[0.6rem] whitespace-normal md:min-w-[16rem]">
      <p>{`${String(row.pending)} pending, ${String(row.approved)} approved, ${String(row.incomplete)} incomplete`}</p>
      {row.missingInformation > 0 && (
        <>
          <p className="text-xs leading-[1.125rem]">
            {`${employeesCount(row.missingInformation)} ${row.missingInformation === 1 ? 'is' : 'are'} missing required information`}
          </p>
          <Link
            to="/benefits/employees"
            search={{ year: row.id, missing: true }}
            className={cn(
              mediumText,
              accent.text,
              'w-fit rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35',
            )}
          >
            Update missing information
          </Link>
        </>
      )}
    </div>
  )
}

const columns: DataTableColumn<PlanYear>[] = [
  { id: 'name', header: 'Plan Year Name', mobile: 'heading', cell: (row) => row.name },
  { id: 'plans', header: 'Plans', cell: (row) => row.planCount },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <Chip meta={PLAN_YEAR_STATUS[row.status]} className="-mt-1" />,
  },
  {
    id: 'duration',
    header: 'Duration',
    cell: (row) => formatDuration(row.startDate, row.endDate),
  },
  {
    id: 'elections',
    header: 'Employee Elections',
    className: 'whitespace-normal',
    cell: (row) => <ElectionsCell row={row} />,
  },
]

/**
 * Plan Years: "Benefit Plan Years" with + New Plan Year; each row's elections, the people who
 * still miss information, and the ⋮ menu (Edit, Delete, Open Enrollment, New Hire, Qualifying
 * Life Event).
 */
export function PlanYearsPage() {
  const { year } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const list = usePlanYears({ year })
  const remove = useDeletePlanYear()
  const canCreate = useCan(BEN_CODES.planYearCreate)
  const canEdit = useCan(BEN_CODES.planYearEdit)
  const canDelete = useCan(BEN_CODES.planYearDelete)
  const canOpenWindow = useCan(BEN_CODES.windowCreate)
  const allowed: PlanYearAction[] = [
    ...(canEdit ? (['edit', 'new-hire'] as const) : []),
    ...(canDelete ? (['delete'] as const) : []),
    ...(canOpenWindow ? (['open-enrollment', 'life-event'] as const) : []),
  ]
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => {
    setDialog(null)
  }

  return (
    <BenefitsPage
      tab="plan-years"
      title="Benefit Plan Years"
      year={year}
      onYearChange={(next) => {
        void navigate({ search: { year: next } })
      }}
      actions={
        canCreate ? (
          <Link to="/benefits/plan-years/new" className={cn(buttonClass, accent.bg, 'px-3')}>
            <AddIcon className="size-[0.8125rem]" />
            New Plan Year
          </Link>
        ) : undefined
      }
    >
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Benefit plan years"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={2}
          className={cn(tableClass, plainRows)}
          emptyState={
            <EmptyList
              action={
                canCreate ? (
                  <Link to="/benefits/plan-years/new" className={cn(mediumText, accent.text)}>
                    New Plan Year
                  </Link>
                ) : undefined
              }
            >
              {year ? 'That plan year is no longer here.' : 'There are no plan years yet.'}
            </EmptyList>
          }
          rowActionsHeader="Action"
          rowActions={(row) => (
            <div className="-mt-1 flex justify-start sm:-mr-2">
              <PlanYearRowMenu
                name={row.name}
                allowed={allowed}
                onSelect={(action) => {
                  if (action === 'edit') setDialog({ type: 'edit', row, step: 'details' })
                  else if (action === 'new-hire')
                    setDialog({ type: 'edit', row, step: 'new-hires' })
                  else if (action === 'delete') setDialog({ type: 'delete', row })
                  else
                    setDialog({
                      type: 'enroll',
                      row,
                      name: action === 'life-event' ? 'Qualifying Life Event' : '',
                      kind: action === 'life-event' ? 'life_event' : 'open_enrollment',
                    })
                }}
              />
            </div>
          )}
        />
      )}

      {dialog?.type === 'edit' && (
        <EditPlanYearDialog
          key={`${dialog.row.id}-${dialog.step}`}
          year={dialog.row}
          startStep={dialog.step}
          onClose={close}
        />
      )}
      {dialog?.type === 'enroll' && (
        <OpenEnrollmentDialog
          planYearId={dialog.row.id}
          initialName={dialog.name}
          kind={dialog.kind}
          onClose={close}
        />
      )}
      <DeleteConfirm
        open={dialog?.type === 'delete'}
        title="Delete Plan Year"
        question={
          dialog?.type === 'delete'
            ? `Are you sure you want to Delete “${dialog.row.name}” plan year?`
            : ''
        }
        confirmLabel="Delete Plan Year"
        pending={remove.isPending}
        onClose={close}
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.row, {
            onSuccess: close,
            onError: (error) => {
              close()
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the plan year.',
              )
            },
          })
        }}
      />
    </BenefitsPage>
  )
}
