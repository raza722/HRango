import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { useCan } from '@/lib/permissions'

import { PAYROLL_CODES } from '../../constants'
import { useAccountStatement } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { AccountStatementRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatMonthShort, formatRs, monthStart } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { EmployeeAccountDialog } from './employee-account-dialog'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'

const routeApi = getRouteApi('/_app/payroll/balances/account-statement')
const PAGE_SIZE = 10

type Dialog = { type: 'filters' } | { type: 'view' | 'edit'; row: AccountStatementRow } | null

const rs = (value: number) => formatRs(value).replace('Rs', 'RS')

const columns: DataTableColumn<AccountStatementRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'account', header: 'Account', cell: (row) => row.accountName },
  { id: 'month', header: 'Month', cell: (row) => formatMonthShort(row.entryMonth) },
  { id: 'credit', header: 'Credit', cell: (row) => rs(row.credit) },
  { id: 'debit', header: 'Debit', cell: (row) => rs(row.debit) },
  { id: 'balance', header: 'Balance', cell: (row) => rs(row.balance) },
]

/**
 * Balances → Employee Account Statement (`GET /payroll/account-statement`): each entry with the
 * account's running balance. Filters: employee, account, months from / to.
 */
export function AccountStatementPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.employee_accounts.view')
  const canEdit = useCan(`${PAYROLL_CODES.employeeAccounts}.edit`)
  const [filters, setFilters] = useFilters('account-statement')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useAccountStatement({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    accountTypeId: filters.accountTypeId,
    from: filters.from ? monthStart(filters.from) : undefined,
    to: filters.to ? monthStart(filters.to) : undefined,
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
      key: 'accountTypeId',
      label: 'Account',
      placeholder: 'Select Account',
      options: options.accountTypes,
    },
    { kind: 'month', key: 'from', label: 'From Month' },
    { kind: 'month', key: 'to', label: 'To Month' },
  ]
  const close = () => {
    setDialog(null)
  }
  const actions = (row: AccountStatementRow): RowAction[] => [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            onSelect: () => {
              setDialog({ type: 'edit', row })
            },
          },
        ]
      : []),
    {
      label: 'View',
      onSelect: () => {
        setDialog({ type: 'view', row })
      },
    },
  ]

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
            label={`Actions for ${row.employeeName}, ${row.accountName} ${formatMonthShort(row.entryMonth)}`}
            actions={actions(row)}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="lines"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {(dialog?.type === 'view' || dialog?.type === 'edit') && (
        <EmployeeAccountDialog id={dialog.row.id} mode={dialog.type} onClose={close} />
      )}
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
