import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useDeleteLeaveEncashment,
  useLeaveEncashments,
  usePayrollSettings,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { LeaveEncashmentRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatRs } from '../../utils/format'
import { currentLeaveYear } from '../../utils/leave-year'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { LeaveEncashmentDialog } from './leave-encashment-dialog'

const routeApi = getRouteApi('/_app/payroll/leave-encashment')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: LeaveEncashmentRow }
  | null

const columns: DataTableColumn<LeaveEncashmentRow>[] = [
  { id: 'leave', header: 'Leave', cell: (row) => row.leave },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'year', header: 'Year', cell: (row) => row.year },
  { id: 'amount', header: 'Amount per leave', cell: (row) => formatRs(row.amountPerLeave) },
]

/**
 * Leave Encashment: unused leave days paid out, one line per person. Edit,
 * View and Delete act on the whole encashment the line belongs to.
 */
export function LeaveEncashmentPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const settings = usePayrollSettings()
  const [filters, setFilters] = useFilters('leave-encashment')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteLeaveEncashment()
  const list = useLeaveEncashments({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    department: filters.department,
    leaveTypeId: filters.leaveTypeId,
    year: numberOf(filters.year),
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const latest = currentLeaveYear(settings.data?.leave)
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      options: options.employees,
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: options.departments,
    },
    {
      kind: 'select',
      key: 'leaveTypeId',
      label: 'Leave Type',
      placeholder: 'Select Leave Type',
      options: (options.lookups?.accountTypes ?? [])
        .filter((item) => item.category === 'leave-quotas')
        .map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'year',
      label: 'Year',
      placeholder: 'Select Year',
      options: Array.from({ length: 5 }, (_, index) => String(latest - index)).map((year) => ({
        value: year,
        label: year,
      })),
    },
  ]
  const close = () => {
    setDialog(null)
  }
  const target = dialog?.type === 'delete' ? dialog.row : null

  return (
    <PayrollCard
      title="Leave Encashment"
      actions={
        <>
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.blue, 'min-w-24')}
          >
            Create
          </Button>
          <FiltersButton
            count={activeCount(filters)}
            onClick={() => {
              setDialog({ type: 'filters' })
            }}
          />
        </>
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Leave encashments"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Action"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.leave}, ${row.employee.name}, ${String(row.year)}`}
            actions={[
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'edit', row })
                },
              },
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDialog({ type: 'delete', row })
                },
              },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="encashments"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && (
        <LeaveEncashmentDialog id={null} mode="create" onClose={close} />
      )}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <LeaveEncashmentDialog id={dialog.row.encashmentId} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="leave-encashment"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete leave encashment"
        message={
          target && target.people > 1
            ? `Are you sure you want to Delete this? It removes the ${target.leave} encashment for all ${String(target.people)} people on it.`
            : 'Are you sure you want to Delete this?'
        }
        onConfirm={() => {
          if (target) {
            remove.mutate(target.encashmentId, {
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the encashment.',
                )
              },
            })
          }
        }}
      />
    </PayrollCard>
  )
}
