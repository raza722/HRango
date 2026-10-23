import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useEmployeeAccounts, useImportEmployeeAccounts } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeAccountRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatMonthShort, formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { ImportButton } from '../shared/menu-button'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { BALANCE_KINDS, parseAccountFile } from './balance-csv'
import { EmployeeAccountDialog } from './employee-account-dialog'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'

const routeApi = getRouteApi('/_app/payroll/balances/employee-accounts')
const PAGE_SIZE = 10

type Dialog = { type: 'create' | 'filters' } | { type: 'edit' | 'view'; id: string } | null

const rs = (value: number) => formatRs(value).replace('Rs', 'RS')

const columns: DataTableColumn<EmployeeAccountRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'account', header: 'Account', cell: (row) => row.account },
  { id: 'month', header: 'Month', cell: (row) => formatMonthShort(row.month) },
  { id: 'credit', header: 'Credit', cell: (row) => rs(row.credit) },
  { id: 'debit', header: 'Debit', cell: (row) => rs(row.debit) },
]

/** Balances → Employee Accounts: credits and debits on a person's accounts (provident fund, loans…). */
export function EmployeeAccountsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('employee-accounts')
  const [dialog, setDialog] = useState<Dialog>(null)
  const importFile = useImportEmployeeAccounts()
  const list = useEmployeeAccounts({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    month: filters.month,
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
    { kind: 'month', key: 'month', label: 'Month' },
  ]
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Employee Accounts"
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
          <ImportButton
            choices={BALANCE_KINDS}
            onFile={(kind, text) =>
              importFile.mutateAsync({ kind, rows: parseAccountFile(kind, text) })
            }
          />
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
        caption="Employee accounts"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employee.name}, ${row.account} ${formatMonthShort(row.month)}`}
            actions={[
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'edit', id: row.id })
                },
              },
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', id: row.id })
                },
              },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="entries"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && (
        <EmployeeAccountDialog id={null} mode="create" onClose={close} />
      )}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <EmployeeAccountDialog id={dialog.id} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="employee-accounts"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
    </PayrollCard>
  )
}
