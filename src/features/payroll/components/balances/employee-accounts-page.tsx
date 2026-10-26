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

import { PAYROLL_CODES } from '../../constants'
import {
  useDeleteEmployeeAccount,
  useEmployeeAccounts,
  useImportEmployeeAccounts,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeAccountRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatMonthShort, formatRs, monthStart } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { downloadImportTemplate } from './balance-csv'
import { CsvImportButton } from './csv-import-button'
import { EmployeeAccountDialog } from './employee-account-dialog'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'

const routeApi = getRouteApi('/_app/payroll/balances/employee-accounts')
const PAGE_SIZE = 10
const CODE = PAYROLL_CODES.employeeAccounts

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view'; id: string }
  | { type: 'delete'; row: EmployeeAccountRow }
  | null

const rs = (value: number) => formatRs(value).replace('Rs', 'RS')

const columns: DataTableColumn<EmployeeAccountRow>[] = [
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
  { id: 'processed', header: 'Processed', cell: (row) => (row.isProcessed ? 'Yes' : 'No') },
]

/** Balances → Employee Accounts (`/payroll/employee-accounts`): credits and debits on people's accounts. */
export function EmployeeAccountsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.employee_accounts.view')
  const can = {
    create: useCan(`${CODE}.create`),
    edit: useCan(`${CODE}.edit`),
    delete: useCan(`${CODE}.delete`),
    import: useCan(`${CODE}.import`),
  }
  const [filters, setFilters] = useFilters('employee-accounts')
  const [dialog, setDialog] = useState<Dialog>(null)
  const importFile = useImportEmployeeAccounts()
  const remove = useDeleteEmployeeAccount()
  const list = useEmployeeAccounts({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    accountTypeId: filters.accountTypeId,
    month: filters.month ? monthStart(filters.month) : undefined,
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
    { kind: 'month', key: 'month', label: 'Month' },
  ]
  const close = () => {
    setDialog(null)
  }
  const actions = (row: EmployeeAccountRow): RowAction[] => {
    const items: (RowAction | false)[] = [
      can.edit && {
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
      can.delete && {
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
      title="Employee Accounts"
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
          {can.import && (
            <>
              <Button
                onClick={() => {
                  void options.sampleEmployeeCode().then((code) => {
                    downloadImportTemplate('employee-account', code)
                  })
                }}
                className={cn(toolbarButton, btn.green)}
              >
                Sample Import
              </Button>
              <CsvImportButton onImport={(fileId) => importFile.mutateAsync({ fileId })} />
            </>
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
        caption="Employee accounts"
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
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete employee account entry"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(
            { id: dialog.row.id, rowVersion: dialog.row.rowVersion },
            {
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the entry.',
                )
              },
            },
          )
        }}
      />
    </PayrollCard>
  )
}
