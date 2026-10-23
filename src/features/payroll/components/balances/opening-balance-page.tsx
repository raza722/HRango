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

import { useImportOpeningBalances, useOpeningBalances } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { OpeningBalanceRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { ImportButton, MenuButton } from '../shared/menu-button'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { BALANCE_KINDS, downloadBalanceTemplate, parseBalanceFile } from './balance-csv'
import { FiltersButton, ListFooter, PersonCell } from './list-parts'
import { OpeningBalanceDialog, OpeningBalanceViewDialog } from './opening-balance-dialogs'

const routeApi = getRouteApi('/_app/payroll/balances/opening-balance')
const PAGE_SIZE = 10

type Dialog =
  { type: 'create' | 'filters' } | { type: 'adjust' | 'view'; row: OpeningBalanceRow } | null

const columns: DataTableColumn<OpeningBalanceRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'department', header: 'Department', cell: (row) => row.employee.department },
  { id: 'net', header: 'Net Amount', cell: (row) => formatRs(row.netAmount).replace('Rs', 'RS') },
]

/** Balances → Opening Balance: amounts carried into payroll per person and pay item. */
export function OpeningBalancePage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('opening-balance')
  const [dialog, setDialog] = useState<Dialog>(null)
  const importFile = useImportOpeningBalances()
  const list = useOpeningBalances({
    page,
    pageSize: PAGE_SIZE,
    locationId: filters.locationId,
    branchId: filters.branchId,
    department: filters.department,
    employeeId: filters.employeeId,
    balanceCode: filters.balanceCode,
    netFrom: numberOf(filters.netFrom),
    netTo: numberOf(filters.netTo),
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: options.locations,
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: options.branches,
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
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      options: options.employees,
    },
    { kind: 'text', key: 'balanceCode', label: 'Code', placeholder: 'Code' },
    { kind: 'range', key: 'net', label: 'Net Amount', from: 'netFrom', to: 'netTo' },
  ]
  const close = () => {
    setDialog(null)
  }
  const sampleCode = options.employeeCodes[0]?.value ?? 'Id-001'

  return (
    <PayrollCard
      title="Opening Balance"
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
          <MenuButton
            label="Sample Import"
            choices={BALANCE_KINDS}
            onChoose={(kind) => {
              downloadBalanceTemplate(kind, sampleCode)
            }}
          />
          <ImportButton
            label="Import"
            choices={BALANCE_KINDS}
            onFile={(kind, text) =>
              importFile.mutateAsync({ kind, rows: parseBalanceFile(kind, text) })
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
        caption="Opening balances"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.code}, ${row.employee.name}`}
            actions={[
              {
                label: 'Adjust',
                onSelect: () => {
                  setDialog({ type: 'adjust', row })
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
        noun="balances"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <OpeningBalanceDialog balance={null} onClose={close} />}
      {dialog?.type === 'adjust' && <OpeningBalanceDialog balance={dialog.row} onClose={close} />}
      {dialog?.type === 'view' && <OpeningBalanceViewDialog id={dialog.row.id} onClose={close} />}
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
