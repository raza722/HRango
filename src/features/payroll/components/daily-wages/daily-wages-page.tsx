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

import { payrollApi } from '../../api/payroll.api'
import { PAYROLL_STATUS_META } from '../../constants'
import { useDailyWages } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { DailyWageBatchRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatMonthComma, formatRs, slotLabel } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { StatusChip } from '../shared/status-chip'
import { downloadDailyWage } from './daily-wage-csv'
import {
  DailyWageCreateDialog,
  DailyWageDetailsDialog,
  DailyWageEditDialog,
} from './daily-wage-dialogs'

const routeApi = getRouteApi('/_app/payroll/payrolls/daily-wages')
const PAGE_SIZE = 10

type Dialog = { type: 'create' | 'filters' } | { type: 'view' | 'edit'; id: string } | null

const columns: DataTableColumn<DailyWageBatchRow>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.name, photoUrl: row.createdBy.photoUrl }} />,
  },
  {
    id: 'slot',
    header: 'Time slot',
    cell: (row) => (
      <span className="block max-w-56 min-w-48 whitespace-normal">{slotLabel(row.timeSlot)}</span>
    ),
  },
  { id: 'date', header: 'Date', cell: (row) => formatMonthComma(row.date.slice(0, 7)) },
  {
    id: 'employees',
    header: 'Total Employees',
    align: 'center',
    cell: (row) => row.totalEmployees,
  },
  { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable) },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusChip {...PAYROLL_STATUS_META[row.status]} />,
  },
]

/**
 * Payrolls → Daily Wages: one payroll per day and time slot, worked out from
 * the people's check in and check out. Create is a two-step wizard.
 */
export function DailyWagesPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('daily-wages')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useDailyWages({
    page,
    pageSize: PAGE_SIZE,
    timeSlotId: filters.timeSlotId,
    name: filters.name,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'timeSlotId',
      label: 'Time Slot',
      placeholder: 'Select Time Slot',
      options: options.timeSlots.map((slot) => ({ value: slot.id, label: slotLabel(slot) })),
    },
    { kind: 'text', key: 'name', label: 'Name' },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]

  const download = async (id: string) => {
    try {
      downloadDailyWage(await payrollApi.dailyWage(id))
    } catch {
      toast.error('Could not download the payroll.')
    }
  }

  return (
    <PayrollCard
      title="Payrolls Daily Wages"
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
        caption="Daily wage payrolls"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.name}, ${row.date}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', id: row.id })
                },
              },
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'edit', id: row.id })
                },
              },
              {
                label: 'Download',
                onSelect: () => {
                  void download(row.id)
                },
              },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="payrolls"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && (
        <DailyWageCreateDialog
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <DailyWageEditDialog
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'view' && (
        <DailyWageDetailsDialog
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="daily-wages"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
    </PayrollCard>
  )
}
