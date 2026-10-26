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
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { payrollApi } from '../../api/payroll.api'
import { PAYROLL_STATUS_META } from '../../constants'
import {
  useCloseDailyWage,
  useDailyWages,
  useDeleteDailyWage,
  useProcessDailyWage,
  useTimeSlotLookup,
} from '../../hooks/use-payroll'
import type { DailyWageBatchRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatLong, formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { StatusChip } from '../shared/status-chip'
import { downloadDailyWage, timeSlotLabel } from './daily-wage-csv'
import {
  DailyWageCreateDialog,
  DailyWageDetailsDialog,
  DailyWageEditDialog,
  DailyWageEmployeesDialog,
  DailyWageErrorsDialog,
} from './daily-wage-dialogs'

const routeApi = getRouteApi('/_app/payroll/payrolls/daily-wages')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'view' | 'edit' | 'employees' | 'errors'; id: string }
  | { type: 'close' | 'delete'; row: DailyWageBatchRow }
  | null

const columns: DataTableColumn<DailyWageBatchRow>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.name, photoUrl: null }} />,
  },
  { id: 'code', header: 'Code', cell: (row) => row.code },
  {
    id: 'slot',
    header: 'Time slot',
    cell: (row) => (
      <span className="block max-w-56 min-w-40 whitespace-normal">{row.timeSlotName ?? '—'}</span>
    ),
  },
  { id: 'date', header: 'Date', cell: (row) => (row.workDate ? formatLong(row.workDate) : '—') },
  {
    id: 'employees',
    header: 'Total Employees',
    align: 'center',
    cell: (row) => row.employeeCount,
  },
  { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable) },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusChip {...PAYROLL_STATUS_META[row.status]} />,
  },
]

/**
 * Payrolls → Daily Wages (`GET /daily-wages`): one run per day and time slot. Create (two
 * steps), then Process works the wages out from the day's time sheet, Edit adjusts totals,
 * Close releases the slips and Voucher pays them.
 */
export function DailyWagesPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const slots = useTimeSlotLookup()
  const [filters, setFilters] = useFilters('daily-wages-v2')
  const [dialog, setDialog] = useState<Dialog>(null)
  const process = useProcessDailyWage()
  const close = useCloseDailyWage()
  const remove = useDeleteDailyWage()
  const can = {
    create: useCan('payroll.daily_wages.create'),
    edit: useCan('payroll.daily_wages.edit'),
    process: useCan('payroll.daily_wages.process'),
    close: useCan('payroll.daily_wages.close'),
    delete: useCan('payroll.daily_wages.delete'),
    export: useCan('payroll.daily_wages.export'),
  }
  const list = useDailyWages({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q,
    status: filters.status,
    timeSlotId: filters.timeSlotId,
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
      options: (slots.data ?? []).map((slot) => ({ value: slot.id, label: timeSlotLabel(slot) })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: Object.entries(PAYROLL_STATUS_META).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
    },
    { kind: 'text', key: 'q', label: 'Name' },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  const failed = (reason: unknown, fallback: string) => {
    toast.error(reason instanceof ApiError ? reason.message : fallback)
  }

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
          {can.create && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.navy)}
            >
              + Create
            </Button>
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
        caption="Daily wage payrolls"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => {
          const open = row.status !== 'closed'
          const actions = [
            {
              label: 'View',
              show: true,
              run: () => {
                setDialog({ type: 'view', id: row.id })
              },
            },
            {
              label: 'Employees',
              show: open && can.edit,
              run: () => {
                setDialog({ type: 'employees', id: row.id })
              },
            },
            {
              label: 'Process',
              show: open && can.process,
              run: () => {
                process.mutate(row.id, {
                  onError: (reason) => {
                    failed(reason, 'The payroll could not be processed.')
                  },
                })
              },
            },
            {
              label: 'Edit',
              show: open && can.edit,
              run: () => {
                setDialog({ type: 'edit', id: row.id })
              },
            },
            {
              label: 'Close',
              show: row.status === 'running' && can.close,
              run: () => {
                setDialog({ type: 'close', row })
              },
            },
            {
              label: 'Errors',
              show: true,
              run: () => {
                setDialog({ type: 'errors', id: row.id })
              },
            },
            {
              label: 'Download',
              show: can.export,
              run: () => {
                void download(row.id)
              },
            },
            {
              label: 'Delete',
              show: open && can.delete,
              run: () => {
                setDialog({ type: 'delete', row })
              },
            },
          ]
          return (
            <RowActionsMenu
              itemClassName={rowMenuItemClass.inter}
              label={`Actions for ${row.name}, ${row.workDate ?? ''}`}
              actions={actions
                .filter((action) => action.show)
                .map((action) => ({
                  label: action.label,
                  onSelect: () => {
                    action.run()
                  },
                }))}
            />
          )
        }}
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
      {dialog?.type === 'employees' && (
        <DailyWageEmployeesDialog
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'errors' && (
        <DailyWageErrorsDialog
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
          preset="daily-wages-v2"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'close'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        tone="danger"
        title="Close daily wage payroll"
        message="Close this payroll? Its wage slips are released and it cannot be changed."
        onConfirm={() => {
          if (dialog?.type !== 'close') return
          close.mutate(
            { id: dialog.row.id, rowVersion: dialog.row.rowVersion },
            {
              onError: (reason) => {
                failed(reason, 'The payroll could not be closed.')
              },
            },
          )
        }}
      />
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        tone="danger"
        title="Delete daily wage payroll"
        message="Delete this daily wage payroll?"
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(
            { id: dialog.row.id, rowVersion: dialog.row.rowVersion },
            {
              onError: (reason) => {
                failed(reason, 'The payroll could not be deleted.')
              },
            },
          )
        }}
      />
    </PayrollCard>
  )
}
