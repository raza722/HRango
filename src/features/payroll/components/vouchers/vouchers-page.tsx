import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'

import { VOUCHER_TYPE_LABELS } from '../../constants'
import { useDeleteVoucher, useVouchers } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { VoucherRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatLong, formatRs, formatShort } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell, ReadOnlyRow } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { PayrollDialog } from '../shared/payroll-dialog'

const routeApi = getRouteApi('/_app/payroll/vouchers/')
const PAGE_SIZE = 10

type Dialog = { type: 'filters' } | { type: 'view' | 'delete'; row: VoucherRow } | null

const columns: DataTableColumn<VoucherRow>[] = [
  {
    id: 'employee',
    header: 'Employee Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'code', header: 'Code', align: 'center', cell: (row) => row.code },
  { id: 'amount', header: 'Amount', align: 'center', cell: (row) => formatRs(row.amount) },
  { id: 'date', header: 'Date', align: 'center', cell: (row) => formatShort(row.date) },
]

/** Vouchers: every payment line (daily wages and employee vouchers). */
export function VouchersPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('vouchers')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteVoucher()
  const list = useVouchers({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    amountFrom: numberOf(filters.amountFrom),
    amountTo: numberOf(filters.amountTo),
    voucherCode: filters.voucherCode,
    type: filters.type,
    date: filters.date,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      options: options.employees,
    },
    { kind: 'range', key: 'amount', label: 'Amount', from: 'amountFrom', to: 'amountTo' },
    { kind: 'text', key: 'voucherCode', label: 'Code' },
    {
      kind: 'select',
      key: 'type',
      label: 'Type',
      placeholder: 'Select Type',
      options: Object.values(VOUCHER_TYPE_LABELS).map((label) => ({ value: label, label })),
    },
    { kind: 'date', key: 'date', label: 'Date' },
  ]
  const close = () => {
    setDialog(null)
  }

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
            label={`Actions for voucher ${row.code}, ${row.employee.name}`}
            actions={[
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
        noun="vouchers"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'view' && (
        <PayrollDialog title="Voucher View" onClose={close} readOnly className="max-w-2xl">
          <div className="grid gap-4">
            <ReadOnlyRow
              label="Employee Name"
              value={`${dialog.row.employee.name} (${dialog.row.employee.code})`}
            />
            <ReadOnlyRow label="Code" value={dialog.row.code} />
            <ReadOnlyRow label="Type" value={VOUCHER_TYPE_LABELS[dialog.row.type]} />
            <ReadOnlyRow label="Amount" value={formatRs(dialog.row.amount)} />
            <ReadOnlyRow label="Date" value={formatLong(dialog.row.date)} />
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
            remove.mutate(dialog.row.id, {
              onError: () => {
                toast.error('Could not delete the voucher.')
              },
            })
          }
        }}
      />
    </PayrollCard>
  )
}
