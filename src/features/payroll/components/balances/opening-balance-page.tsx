import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYROLL_CODES } from '../../constants'
import { useImportOpeningBalances, useOpeningBalances } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { OpeningBalanceRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatMonthComma, formatRs, monthStart } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { downloadImportTemplate } from './balance-csv'
import { CsvImportButton } from './csv-import-button'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'
import { OpeningBalanceDialog, OpeningBalanceViewDialog } from './opening-balance-dialogs'

const routeApi = getRouteApi('/_app/payroll/balances/opening-balance')
const PAGE_SIZE = 10
const CODE = PAYROLL_CODES.openingBalances

type Dialog =
  { type: 'create' | 'filters' } | { type: 'adjust' | 'view'; row: OpeningBalanceRow } | null

const columns: DataTableColumn<OpeningBalanceRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.employeeCode },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
  { id: 'entries', header: 'Entries', cell: (row) => row.entryCount },
  {
    id: 'last',
    header: 'Last Month',
    cell: (row) => (row.lastMonth ? formatMonthComma(row.lastMonth) : '—'),
  },
  { id: 'net', header: 'Net Amount', cell: (row) => formatRs(row.netAmount).replace('Rs', 'RS') },
]

/** Balances → Opening Balance (`/payroll/opening-balances`): one line per person, net of their entries. */
export function OpeningBalancePage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.opening_balances.view')
  const can = {
    create: useCan(`${CODE}.create`),
    import: useCan(`${CODE}.import`),
  }
  const [filters, setFilters] = useFilters('opening-balance')
  const [dialog, setDialog] = useState<Dialog>(null)
  const importFile = useImportOpeningBalances()
  const list = useOpeningBalances({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q,
    departmentId: filters.departmentId,
    employeeId: filters.employeeId,
    month: filters.month ? monthStart(filters.month) : undefined,
    netFrom: numberOf(filters.netFrom),
    netTo: numberOf(filters.netTo),
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Name or code' },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: options.departments,
    },
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      filters: options.employeeFilters,
    },
    { kind: 'month', key: 'month', label: 'Month' },
    { kind: 'range', key: 'net', label: 'Net Amount', from: 'netFrom', to: 'netTo' },
  ]
  const close = () => {
    setDialog(null)
  }
  const actions = (row: OpeningBalanceRow): RowAction[] => [
    ...(can.create
      ? [
          {
            label: 'Adjust',
            onSelect: () => {
              setDialog({ type: 'adjust', row })
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
      title="Opening Balance"
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
                    downloadImportTemplate('opening-balance', code)
                  })
                }}
                className={cn(toolbarButton, btn.green)}
              >
                Sample Import
              </Button>
              <CsvImportButton
                label="Import"
                onImport={(fileId) => importFile.mutateAsync({ fileId })}
              />
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
        getRowId={(row) => row.employeeId}
        caption="Opening balances"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employeeCode}, ${row.employeeName}`}
            actions={actions(row)}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="balances"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <OpeningBalanceDialog balance={null} onClose={close} />}
      {dialog?.type === 'adjust' && <OpeningBalanceDialog balance={dialog.row} onClose={close} />}
      {dialog?.type === 'view' && (
        <OpeningBalanceViewDialog id={dialog.row.employeeId} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="opening-balance"
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
