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
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'

import {
  PAYMENT_METHOD_LABELS,
  PAYROLL_CODES,
  VOUCHER_STATUS_LABELS,
  VOUCHER_TYPE_LABELS,
} from '../../constants'
import { useDeleteVoucher, useVouchers } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import { VOUCHER_STATUSES, type VoucherLineType, type VoucherRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatLong, formatRs, formatShort } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell, ReadOnlyRow } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { PayrollDialog } from '../shared/payroll-dialog'
import { VoucherStatusChip } from './voucher-status'

const routeApi = getRouteApi('/_app/payroll/vouchers/')
const PAGE_SIZE = 10

type Dialog = { type: 'filters' } | { type: 'view' | 'delete'; row: VoucherRow } | null

const columns: DataTableColumn<VoucherRow>[] = [
  {
    id: 'employee',
    header: 'Employee Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'code', header: 'Code', align: 'center', cell: (row) => row.voucherNo },
  {
    id: 'type',
    header: 'Type',
    align: 'center',
    cell: (row) => VOUCHER_TYPE_LABELS[row.voucherType],
  },
  { id: 'amount', header: 'Amount', align: 'center', cell: (row) => formatRs(row.amount) },
  { id: 'date', header: 'Date', align: 'center', cell: (row) => formatShort(row.voucherDate) },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <VoucherStatusChip status={row.status} />,
  },
]

/** Vouchers: every voucher (raised by people and made from daily-wage runs), `GET /payroll/vouchers`. */
export function VouchersPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.vouchers.view')
  const canDelete = useCan(`${PAYROLL_CODES.vouchers}.delete`)
  const [filters, setFilters] = useFilters('vouchers')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteVoucher()
  const list = useVouchers({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    departmentId: filters.departmentId,
    amountFrom: numberOf(filters.amountFrom),
    amountTo: numberOf(filters.amountTo),
    voucherCode: filters.voucherCode,
    type: filters.type,
    status: filters.status,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employees',
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
    { kind: 'range', key: 'amount', label: 'Amount', from: 'amountFrom', to: 'amountTo' },
    { kind: 'text', key: 'voucherCode', label: 'Code' },
    {
      kind: 'select',
      key: 'type',
      label: 'Type',
      placeholder: 'Select Type',
      options: (Object.keys(VOUCHER_TYPE_LABELS) as VoucherLineType[]).map((value) => ({
        value,
        label: VOUCHER_TYPE_LABELS[value],
      })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: VOUCHER_STATUSES.map((value) => ({ value, label: VOUCHER_STATUS_LABELS[value] })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  const close = () => {
    setDialog(null)
  }
  const actions = (row: VoucherRow): RowAction[] => [
    {
      label: 'View',
      onSelect: () => {
        setDialog({ type: 'view', row })
      },
    },
    ...(canDelete && row.status !== 'processed'
      ? [
          {
            label: 'Delete',
            variant: 'destructive' as const,
            onSelect: () => {
              setDialog({ type: 'delete', row })
            },
          },
        ]
      : []),
  ]

  return (
    <PayrollCard
      title="Vouchers"
      actions={
        <FiltersButton
          count={activeCount(filters)}
          onClick={() => {
            setDialog({ type: 'filters' })
          }}
        />
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Vouchers"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for voucher ${row.voucherNo}, ${row.employeeName}`}
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

      {dialog?.type === 'view' && (
        <PayrollDialog title="Voucher View" onClose={close} readOnly className="max-w-2xl">
          <div className="grid gap-4">
            <ReadOnlyRow
              label="Employee Name"
              value={`${dialog.row.employeeName} (${dialog.row.employeeCode})`}
            />
            <ReadOnlyRow label="Code" value={dialog.row.voucherNo} />
            <ReadOnlyRow label="Type" value={VOUCHER_TYPE_LABELS[dialog.row.voucherType]} />
            <ReadOnlyRow label="Amount" value={formatRs(dialog.row.amount)} />
            <ReadOnlyRow label="Date" value={formatLong(dialog.row.voucherDate)} />
            <ReadOnlyRow
              label="Payment Method"
              value={
                dialog.row.paymentMethod ? PAYMENT_METHOD_LABELS[dialog.row.paymentMethod] : '—'
              }
            />
            <ReadOnlyRow label="Status" value={VOUCHER_STATUS_LABELS[dialog.row.status]} />
            {dialog.row.payrollName && (
              <ReadOnlyRow label="Payroll" value={dialog.row.payrollName} />
            )}
            {dialog.row.file && (
              <ReadOnlyRow
                label="Attachment"
                value={
                  <a
                    href={dialog.row.file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {dialog.row.file.name ?? 'Attachment'}
                  </a>
                }
              />
            )}
          </div>
        </PayrollDialog>
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="vouchers"
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
        title="Delete voucher"
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
