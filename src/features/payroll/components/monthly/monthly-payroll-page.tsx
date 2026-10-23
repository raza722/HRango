import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Eye,
  Hand,
  type LucideIcon,
  Pencil,
  Play,
  Square,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { PAYROLL_STATUS_META } from '../../constants'
import {
  useClosePayroll,
  useHoldPayrolls,
  usePayrolls,
  useRunPayroll,
} from '../../hooks/use-payroll'
import type { PayrollRow, PayrollStatus } from '../../types/payroll.types'
import { formatMonthComma, formatStamp } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { ActionIcon } from '../shared/action-icon'
import { ConfirmAction } from '../shared/confirm-action'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { StatusChip } from '../shared/status-chip'
import { EmploymentsDialog, PayrollErrorsDialog, PayrollHistoryDialog } from './payroll-dialogs'
import { PayrollFormDialog } from './payroll-form-dialog'

const routeApi = getRouteApi('/_app/payroll/payrolls/monthly')
const PAGE_SIZE = 10

type ActionKey = 'edit' | 'view' | 'run' | 'stop' | 'error' | 'sheet' | 'employments' | 'hold'

/** The legend above the frame: each action's icon, colour and name. */
const ACTIONS: Record<ActionKey, { icon: LucideIcon; label: string; colour: string }> = {
  edit: { icon: Pencil, label: 'Edit', colour: 'bg-[#2CBD4D]' },
  view: { icon: Eye, label: 'View', colour: 'bg-[#3B6FF5]' },
  run: { icon: Play, label: 'Run', colour: 'bg-[#F2683B]' },
  stop: { icon: Square, label: 'Stop', colour: 'bg-[#8B5CF6]' },
  error: { icon: TriangleAlert, label: 'Error', colour: 'bg-[#E50141]' },
  sheet: { icon: ArrowRight, label: 'Salary Sheet', colour: 'bg-[#4CBB6C]' },
  employments: { icon: UserRound, label: 'View Employments', colour: 'bg-[#17A2B8]' },
  hold: { icon: Hand, label: 'On Hold', colour: 'bg-[#EB3434]' },
}

/** Which icons each status shows, as drawn (a new payroll has not been run yet). */
const ACTIONS_BY_STATUS: Record<PayrollStatus, ActionKey[]> = {
  run: ['edit', 'view', 'run', 'stop', 'error', 'sheet', 'employments', 'hold'],
  closed: ['edit', 'view', 'run', 'sheet', 'employments'],
  'on-hold': ['edit', 'view', 'run', 'stop', 'error', 'sheet', 'employments'],
  pending: ['edit', 'view', 'run', 'employments'],
}

type Dialog =
  | { type: 'create' }
  | { type: 'edit' | 'view' | 'history' | 'errors' | 'employments' | 'close'; payroll: PayrollRow }
  | null

/**
 * Payrolls → Monthly: the payroll definitions with their month, last run and
 * closing, status and the round action icons; + Create, and On Hold for the
 * ticked rows.
 */
export function MonthlyPayrollPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const list = usePayrolls({ page: search.page, pageSize: PAGE_SIZE })
  const run = useRunPayroll()
  const close = useClosePayroll()
  const hold = useHoldPayrolls()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const rows = list.data?.data ?? []
  const meta = list.data?.meta
  const allTicked = rows.length > 0 && rows.every((row) => selected.has(row.id))

  const failed = (failure: unknown, fallback: string) => {
    toast.error(failure instanceof ApiError ? failure.message : fallback)
  }

  const act = (key: ActionKey, payroll: PayrollRow) => {
    if (key === 'edit' || key === 'view' || key === 'employments') setDialog({ type: key, payroll })
    else if (key === 'error') setDialog({ type: 'errors', payroll })
    else if (key === 'stop') setDialog({ type: 'close', payroll })
    else if (key === 'sheet')
      void goTo({ to: '/payroll/salary-sheet', search: { payrollId: payroll.id } })
    else if (key === 'run') {
      run.mutate(payroll.id, {
        onError: (failure) => {
          failed(failure, 'The payroll could not be run.')
        },
      })
    } else {
      hold.mutate([payroll.id], {
        onError: (failure) => {
          failed(failure, 'The payroll could not be put on hold.')
        },
      })
    }
  }

  const columns: DataTableColumn<PayrollRow>[] = [
    {
      id: 'select',
      header: (
        <Checkbox
          aria-label="Select all payrolls on this page"
          checked={allTicked}
          disabled={rows.length === 0}
          onCheckedChange={(checked) => {
            setSelected(checked === true ? new Set(rows.map((row) => row.id)) : new Set())
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          aria-label={`Select ${row.name}`}
          checked={selected.has(row.id)}
          onCheckedChange={(checked) => {
            setSelected((current) => {
              const next = new Set(current)
              if (checked === true) next.add(row.id)
              else next.delete(row.id)
              return next
            })
          }}
        />
      ),
      className: 'w-10',
      mobile: 'hidden',
    },
    { id: 'code', header: 'Code', cell: (row) => row.code },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => row.name,
      mobile: 'heading',
    },
    {
      id: 'tax',
      header: 'Tax Structure',
      cell: (row) => (
        <span className="block max-w-32 min-w-28 whitespace-normal">
          {row.taxStructureName ?? '—'}
        </span>
      ),
    },
    { id: 'month', header: 'Month', cell: (row) => formatMonthComma(row.month) },
    {
      id: 'lastRun',
      header: 'Last Running',
      cell: (row) => <Stamp value={row.lastRunAt} />,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <StatusChip {...PAYROLL_STATUS_META[row.status]} />,
    },
    {
      id: 'lastClose',
      header: 'Last Closing',
      cell: (row) => <Stamp value={row.lastClosedAt} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          {ACTIONS_BY_STATUS[row.status].map((key) => {
            const action = ACTIONS[key]
            return (
              <ActionIcon
                key={key}
                icon={action.icon}
                tooltip={action.label}
                label={`${action.label}, ${row.name}`}
                colour={action.colour}
                disabled={(key === 'run' && run.isPending) || (key === 'hold' && hold.isPending)}
                onClick={() => {
                  act(key, row)
                }}
              />
            )
          })}
        </span>
      ),
    },
  ]

  return (
    <PayrollCard
      title="Payrolls Monthly"
      actions={
        <>
          <Button
            disabled={selected.size === 0 || hold.isPending}
            onClick={() => {
              hold.mutate([...selected], {
                onSuccess: () => {
                  setSelected(new Set())
                },
                onError: (failure) => {
                  failed(failure, 'The payrolls could not be put on hold.')
                },
              })
            }}
            className={cn(toolbarButton, btn.hold, 'px-7')}
          >
            On Hold
          </Button>
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.navy, 'px-5')}
          >
            + Create
          </Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Monthly payrolls"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord className="m-2" />}
      />
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            disabled={list.isFetching}
            onPageChange={(page) => {
              void navigate({ search: (prev) => ({ ...prev, page }) })
            }}
          />
        </div>
      )}

      {(dialog?.type === 'create' || dialog?.type === 'edit' || dialog?.type === 'view') && (
        <PayrollFormDialog
          mode={dialog.type}
          payroll={dialog.type === 'create' ? null : dialog.payroll}
          onClose={() => {
            setDialog(null)
          }}
          onHistory={
            dialog.type === 'view'
              ? () => {
                  setDialog({ type: 'history', payroll: dialog.payroll })
                }
              : undefined
          }
        />
      )}
      {dialog?.type === 'history' && (
        <PayrollHistoryDialog
          payroll={dialog.payroll}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'errors' && (
        <PayrollErrorsDialog
          payroll={dialog.payroll}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'employments' && (
        <EmploymentsDialog
          payroll={dialog.payroll}
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
        title="Close payroll"
        message="Are you sure you want to Close this Payroll? Once done, it cannot be reverted."
        onConfirm={() => {
          if (dialog?.type !== 'close') return
          close.mutate(dialog.payroll.id, {
            onError: (failure) => {
              failed(failure, 'The payroll could not be closed.')
            },
          })
        }}
      />
    </PayrollCard>
  )
}

/** "September 5, / 2024 04:22 PM" on two lines, as drawn. */
function Stamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const text = formatStamp(value)
  const [date = '', rest = ''] = text.split(/(?<=,) /)
  return (
    <span className="block leading-snug whitespace-nowrap">
      {date}
      <span className="block">{rest}</span>
    </span>
  )
}
