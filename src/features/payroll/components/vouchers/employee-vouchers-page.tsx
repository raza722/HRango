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

import { PAYROLL_CODES, VOUCHER_STATUS_LABELS, VOUCHER_TYPE_LABELS } from '../../constants'
import { useDeleteVoucher, useVouchers } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import { VOUCHER_STATUSES, VOUCHER_TYPES, type VoucherRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { EmployeeVoucherDialog, VoucherDecisionDialog } from './employee-voucher-dialog'
import { VoucherStatusChip } from './voucher-status'

const routeApi = getRouteApi('/_app/payroll/vouchers/employee')
const PAGE_SIZE = 10
const CODE = PAYROLL_CODES.vouchers

type Decision = 'approve' | 'reject' | 'verify'
type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: VoucherRow }
  | { type: 'decide'; action: Decision; row: VoucherRow }
  | null

const columns: DataTableColumn<VoucherRow>[] = [
  { id: 'code', header: 'Employee ID', cell: (row) => row.employeeCode },
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
  {
    id: 'designation',
    header: 'Designation',
    cell: (row) => (
      <span className="block max-w-40 whitespace-normal">{row.designationName ?? '—'}</span>
    ),
  },
  { id: 'voucher', header: 'Voucher No', cell: (row) => row.voucherNo },
  { id: 'type', header: 'Type', cell: (row) => VOUCHER_TYPE_LABELS[row.voucherType] },
  { id: 'amount', header: 'Amount', cell: (row) => formatRs(row.amount) },
  { id: 'status', header: 'Status', cell: (row) => <VoucherStatusChip status={row.status} /> },
]

/**
 * Vouchers → Employee Voucher: vouchers raised for a person (`/payroll/vouchers`), approved or
 * rejected by a manager, then verified for payment by Finance.
 */
export function EmployeeVouchersPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.vouchers.view')
  const can = {
    create: useCan(`${CODE}.create`),
    edit: useCan(`${CODE}.edit`),
    delete: useCan(`${CODE}.delete`),
    approve: useCan(`${CODE}.approve`),
    reject: useCan(`${CODE}.reject`),
    verify: useCan(`${CODE}.verify`),
  }
  const [filters, setFilters] = useFilters('employee-vouchers')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteVoucher()
  const list = useVouchers({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q,
    employeeId: filters.employeeId,
    departmentId: filters.departmentId,
    designationId: filters.designationId,
    type: filters.type,
    status: filters.status,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Name, code or voucher no' },
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Name',
      placeholder: 'Select Employee',
      filters: options.employeeFilters,
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: options.departments,
    },
    {
      kind: 'select',
      key: 'designationId',
      label: 'Designation',
      placeholder: 'Select Designation',
      options: options.designations,
    },
    {
      kind: 'select',
      key: 'type',
      label: 'Type',
      placeholder: 'Select Type',
      options: VOUCHER_TYPES.map((value) => ({ value, label: VOUCHER_TYPE_LABELS[value] })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: VOUCHER_STATUSES.map((value) => ({ value, label: VOUCHER_STATUS_LABELS[value] })),
    },
  ]
  const close = () => {
    setDialog(null)
  }

  const actions = (row: VoucherRow): RowAction[] => {
    const pending = row.status === 'pending'
    const items: (RowAction | false)[] = [
      can.edit &&
        pending &&
        row.voucherType !== 'daily_wage' && {
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
      can.approve &&
        pending && {
          label: 'Approve',
          onSelect: () => {
            setDialog({ type: 'decide', action: 'approve', row })
          },
        },
      can.reject &&
        pending && {
          label: 'Reject',
          onSelect: () => {
            setDialog({ type: 'decide', action: 'reject', row })
          },
        },
      can.verify &&
        row.status === 'approved' && {
          label: 'Verify',
          onSelect: () => {
            setDialog({ type: 'decide', action: 'verify', row })
          },
        },
      can.delete &&
        row.status !== 'processed' && {
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
      title="Employee Voucher"
      actions={
        <>
          {can.create && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.navy)}
            >
              + Create
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
        caption="Employee vouchers"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employeeName}, voucher ${row.voucherNo}`}
            actions={actions(row)}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="vouchers"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && (
        <EmployeeVoucherDialog id={null} mode="create" onClose={close} />
      )}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <EmployeeVoucherDialog id={dialog.row.id} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'decide' && (
        <VoucherDecisionDialog row={dialog.row} action={dialog.action} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="employee-vouchers"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete employee voucher"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(
              { id: dialog.row.id, rowVersion: dialog.row.rowVersion },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not delete the voucher.',
                  )
                },
              },
            )
          }
        }}
      />
    </PayrollCard>
  )
}
