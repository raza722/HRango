import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { WINDOW_STATUS } from '../../constants'
import {
  useBenefitsLookups,
  useDeleteEnrollmentWindow,
  useEnrollmentWindows,
} from '../../hooks/use-benefits'
import type { EnrollmentWindowRow } from '../../types/benefits.types'
import { formatDay } from '../../utils/format'
import { PlanDeleteIcon } from '../shared/benefit-icons'
import { ruledRows, tableClass } from '../shared/benefit-styles'
import { DeleteConfirm } from '../shared/dialogs'
import { Chip, EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'

const routeApi = getRouteApi('/_app/benefits/enrollment-windows')

/**
 * Enrollment Windows (no frame draws this tab): the windows opened from the plan years' menus,
 * in the Plans table's style, with their dates, plans, people and whether they are still open.
 */
export function EnrollmentWindowsPage() {
  const { year } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const list = useEnrollmentWindows({ year })
  const lookups = useBenefitsLookups()
  const remove = useDeleteEnrollmentWindow()
  const [deleting, setDeleting] = useState<EnrollmentWindowRow | null>(null)
  const planName = (id: string) => lookups.data?.plans.find((plan) => plan.id === id)?.name ?? id

  const columns: DataTableColumn<EnrollmentWindowRow>[] = [
    {
      id: 'name',
      header: 'Enrollment Name',
      mobile: 'heading',
      className: 'font-medium whitespace-normal',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    { id: 'year', header: 'Plan Year', cell: (row) => row.planYearName },
    { id: 'effective', header: 'Effective Date', cell: (row) => formatDay(row.effectiveDate) },
    { id: 'ends', header: 'Enrollment Ends', cell: (row) => formatDay(row.enrollmentEndDate) },
    {
      id: 'plans',
      header: 'Plans',
      className: 'whitespace-normal',
      cell: (row) => (
        <span className="line-clamp-2 min-w-40">
          {row.planIds.length > 0 ? row.planIds.map(planName).join(', ') : '—'}
        </span>
      ),
    },
    { id: 'employees', header: 'Employees', cell: (row) => row.employeeIds.length },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={WINDOW_STATUS[row.status]} className="-my-1" />,
    },
  ]

  return (
    <BenefitsPage
      tab="enrollment-windows"
      title="Enrollment Windows"
      year={year}
      onYearChange={(next) => {
        void navigate({ search: { year: next } })
      }}
    >
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Enrollment windows"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={2}
          className={cn(tableClass, ruledRows)}
          emptyState={
            <EmptyList>
              There are no enrollment windows yet. Open one from a plan year’s menu: Open
              Enrollment.
            </EmptyList>
          }
          rowActionsHeader="Action"
          rowActions={(row) => (
            <button
              type="button"
              aria-label={`Delete ${row.name}`}
              onClick={() => {
                setDeleting(row)
              }}
              className="flex size-8 items-center justify-center rounded-md text-[#C2420B] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 sm:-my-1"
            >
              <PlanDeleteIcon className="h-[1.05rem] w-[0.94rem]" />
            </button>
          )}
        />
      )}
      <DeleteConfirm
        open={deleting !== null}
        title="Delete Enrollment Window"
        question={
          deleting ? `Are you sure you want to Delete “${deleting.name}” enrollment window?` : ''
        }
        confirmLabel="Delete Window"
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null)
        }}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null)
            },
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the window.',
              )
            },
          })
        }}
      />
    </BenefitsPage>
  )
}
