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
import { cn } from '@/lib/utils'

import { useDeleteEmployeeVoucher, useEmployeeVouchers } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeVoucherRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { EmployeeVoucherDialog } from './employee-voucher-dialog'

const routeApi = getRouteApi('/_app/payroll/vouchers/employee')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: EmployeeVoucherRow }
  | null

const columns: DataTableColumn<EmployeeVoucherRow>[] = [
  { id: 'code', header: 'Employee ID', cell: (row) => row.employee.code },
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'department', header: 'Department', cell: (row) => row.employee.department },
  {
    id: 'designation',
    header: 'Designation',
    cell: (row) => (
      <span className="block max-w-40 whitespace-normal">{row.employee.designation}</span>
    ),
  },
]

/** Vouchers → Employee Voucher Creation: vouchers raised for a person, with approval and verification. */
export function EmployeeVouchersPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('employee-vouchers')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteEmployeeVoucher()
  const list = useEmployeeVouchers({
    page,
    pageSize: PAGE_SIZE,
    code: filters.code,
    employeeId: filters.employeeId,
    department: filters.department,
    designation: filters.designation,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    { kind: 'text', key: 'code', label: 'Employee ID', placeholder: 'AD-90890' },
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Name',
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
      key: 'designation',
      label: 'Designation',
      placeholder: 'Select Designation',
      options: options.designations,
    },
  ]
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Employee Voucher"
      actions={
        <>
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.navy)}
          >
            + Create
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
        caption="Employee vouchers"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employee.name}, voucher ${row.voucherNo}`}
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
