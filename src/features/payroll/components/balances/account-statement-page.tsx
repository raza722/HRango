import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

import { useAccountStatement, useEmployeeAccounts } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { AccountStatementRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatMonthShort, formatRs } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { PayrollDialog } from '../shared/payroll-dialog'
import { EmployeeAccountDialog } from './employee-account-dialog'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'

const routeApi = getRouteApi('/_app/payroll/balances/account-statement')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'filters' }
  | { type: 'view'; row: AccountStatementRow }
  | { type: 'edit'; row: AccountStatementRow }
  | null

const rs = (value: number) => formatRs(value).replace('Rs', 'RS')

const columns: DataTableColumn<AccountStatementRow>[] = [
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

/** The entries behind one statement line (a person's account in a month). */
function useEntries(row: AccountStatementRow) {
  const entries = useEmployeeAccounts({
    page: 1,
    pageSize: 100,
    employeeId: row.employee.id,
    month: row.month,
  })
  return {
    isPending: entries.isPending,
    rows: (entries.data?.data ?? []).filter((entry) => entry.accountTypeId === row.accountTypeId),
  }
}

function StatementView({ row, onClose }: { row: AccountStatementRow; onClose: () => void }) {
  const entries = useEntries(row)
  return (
    <PayrollDialog
      title="Employee Account Statement"
      onClose={onClose}
      readOnly
      className="max-w-3xl"
    >
      <div className="grid gap-4">
        <p className="font-inter text-sm text-field-value">
          <span className="font-medium text-heading">{row.employee.name}</span> · {row.account} ·{' '}
          {formatMonthShort(row.month)}
        </p>
        {entries.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : entries.rows.length === 0 ? (
          <NoRecord />
        ) : (
          <table className={`w-full text-left ${payrollTableClass}`}>
            <caption className="sr-only">Entries</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Month</th>
                <th scope="col">Credit</th>
                <th scope="col">Debit</th>
                <th scope="col">Processed</th>
              </tr>
            </thead>
            <tbody>
              {entries.rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.account}</td>
                  <td>{formatMonthShort(entry.month)}</td>
                  <td>{rs(entry.credit)}</td>
                  <td>{rs(entry.debit)}</td>
                  <td>
                    <Checkbox checked={entry.processed} disabled aria-label="Processed" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PayrollDialog>
  )
}

/** Edit on a statement line opens the newest entry behind it. */
function StatementEdit({ row, onClose }: { row: AccountStatementRow; onClose: () => void }) {
  const entries = useEntries(row)
  const newest = entries.rows[0]
  if (!newest) {
    return (
      <PayrollDialog title="Employee Account Edit" onClose={onClose} readOnly>
        {entries.isPending ? <Skeleton className="h-24 w-full" /> : <NoRecord />}
      </PayrollDialog>
    )
  }
  return <EmployeeAccountDialog id={newest.id} mode="edit" onClose={onClose} />
}

/** Balances → Employee Account Statement: each person's credits and debits per account and month. */
export function AccountStatementPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('account-statement')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useAccountStatement({
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
      title="Employee Account Statement"
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
        caption="Employee account statement"
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
                  setDialog({ type: 'edit', row })
                },
              },
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="lines"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'view' && <StatementView row={dialog.row} onClose={close} />}
      {dialog?.type === 'edit' && <StatementEdit row={dialog.row} onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="account-statement"
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
