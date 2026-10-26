import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { payrollApi } from '../../api/payroll.api'
import { PAYROLL_CODES } from '../../constants'
import {
  useDeleteLeaveEncashment,
  useLeaveEncashments,
  useLeaveTypeLookup,
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
const CODE = PAYROLL_CODES.leaveEncashment

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: LeaveEncashmentRow }
  | null

const columns: DataTableColumn<LeaveEncashmentRow>[] = [
  { id: 'leave', header: 'Leave', cell: (row) => row.leaveTypeName ?? '—' },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'year', header: 'Year', cell: (row) => row.fiscalYear ?? '—' },
  { id: 'days', header: 'Days', cell: (row) => row.days },
  { id: 'per', header: 'Amount per leave', cell: (row) => formatRs(row.amountPerLeave) },
  { id: 'amount', header: 'Amount', cell: (row) => formatRs(row.amount) },
]

/**
 * Leave Encashment (`/payroll/leave-encashments`): unused leave days paid out, one line per
 * person. Edit, View and Delete act on the whole encashment the line belongs to; a paid one is
 * locked.
 */
export function LeaveEncashmentPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.leave_encashment.view')
  const leaveTypes = useLeaveTypeLookup()
  const settings = usePayrollSettings()
  const can = {
    create: useCan(`${CODE}.create`),
    edit: useCan(`${CODE}.edit`),
    delete: useCan(`${CODE}.delete`),
  }
  const [filters, setFilters] = useFilters('leave-encashment')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteLeaveEncashment()
  const list = useLeaveEncashments({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    leaveTypeId: filters.leaveTypeId,
    year: numberOf(filters.year),
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const latest = currentLeaveYear(settings.data)
  const fields: FilterField[] = [
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      filters: options.employeeFilters,
    },
    {
      kind: 'select',
      key: 'leaveTypeId',
      label: 'Leave Type',
      placeholder: 'Select Leave Type',
      options: (leaveTypes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
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
  const actions = (row: LeaveEncashmentRow): RowAction[] => {
    const open = row.isPaid !== true
    const items: (RowAction | false)[] = [
      can.edit && {
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
      can.delete &&
        open && {
          label: 'Delete',
          variant: 'destructive',
          onSelect: () => {
            setDialog({ type: 'delete', row })
          },
        },
    ]
    return items.filter((item): item is RowAction => item !== false)
  }

  return (
    <PayrollCard
      title="Leave Encashment"
      actions={
        <>
          {can.create && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-24')}
            >
              Create
            </Button>
          )}
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
            label={`Actions for ${row.leaveTypeName ?? 'Leave'}, ${row.employeeName}, ${String(row.fiscalYear ?? '')}`}
            actions={actions(row)}
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
        <LeaveEncashmentDialog
          id={dialog.row.leaveEncashmentId ?? null}
          mode={dialog.type}
          onClose={close}
        />
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
        message="Are you sure you want to Delete this? It removes the whole encashment, for everyone on it."
        onConfirm={() => {
          const id = target?.leaveEncashmentId
          if (!id) return
          // The delete needs the encashment's row version; a list line may not carry it.
          void (
            target.rowVersion
              ? Promise.resolve(target.rowVersion)
              : payrollApi.leaveEncashment(id).then((detail) => detail.rowVersion)
          )
            .then((rowVersion) => remove.mutateAsync({ id, rowVersion }))
            .catch((error: unknown) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the encashment.',
              )
            })
        }}
      />
    </PayrollCard>
  )
}
