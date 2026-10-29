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
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYROLL_STATUS_META } from '../../constants'
import {
  useClosePayroll,
  useDeletePayroll,
  useHoldPayroll,
  usePayrolls,
  useRunPayroll,
} from '../../hooks/use-payroll'
import type { PageSearch } from '../../routing'
import type { PayrollRow, PayrollStatus } from '../../types/payroll.types'
import { formatMonth, formatMonthComma, formatRs, formatStamp } from '../../utils/format'
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

type ActionKey =
  | 'edit'
  | 'view'
  | 'run'
  | 'close'
  | 'error'
  | 'sheet'
  | 'employments'
  | 'hold'
  | 'unhold'
  | 'delete'

/** Each action's icon, colour and name. */
const ACTIONS: Record<ActionKey, { icon: LucideIcon; label: string; colour: string }> = {
  edit: { icon: Pencil, label: 'Edit', colour: 'bg-[#2CBD4D]' },
  view: { icon: Eye, label: 'View', colour: 'bg-[#3B6FF5]' },
  run: { icon: Play, label: 'Run', colour: 'bg-[#F2683B]' },
  close: { icon: Square, label: 'Close', colour: 'bg-[#8B5CF6]' },
  error: { icon: TriangleAlert, label: 'Error', colour: 'bg-[#E50141]' },
  sheet: { icon: ArrowRight, label: 'Salary Sheet', colour: 'bg-[#4CBB6C]' },
  employments: { icon: UserRound, label: 'View Employments', colour: 'bg-[#17A2B8]' },
  hold: { icon: Hand, label: 'On Hold', colour: 'bg-[#EB3434]' },
  unhold: { icon: Hand, label: 'Release Hold', colour: 'bg-[#0F9F8F]' },
  delete: { icon: Trash2, label: 'Delete', colour: 'bg-[#707070]' },
}

/** Which icons each status shows (a closed payroll cannot be changed or run again). */
const ACTIONS_BY_STATUS: Record<PayrollStatus, ActionKey[]> = {
  open: ['edit', 'view', 'run', 'employments', 'delete'],
  running: ['edit', 'view', 'run', 'close', 'error', 'sheet', 'employments', 'hold', 'delete'],
  on_hold: ['edit', 'view', 'run', 'close', 'error', 'sheet', 'employments', 'unhold'],
  closed: ['view', 'error', 'sheet', 'employments'],
}

/** The permission each action needs. */
const ACTION_CODES: Record<ActionKey, string> = {
  edit: 'payroll.payrolls.edit',
  view: 'payroll.payrolls.view',
  run: 'payroll.payrolls.process',
  close: 'payroll.payrolls.close',
  error: 'payroll.payrolls.view',
  sheet: 'payroll.salary_sheet.view',
  employments: 'payroll.payrolls.view',
  hold: 'payroll.payrolls.edit',
  unhold: 'payroll.payrolls.edit',
  delete: 'payroll.payrolls.delete',
}

type Dialog =
  | { type: 'create' }
  | {
      type: 'edit' | 'view' | 'history' | 'errors' | 'employments' | 'close' | 'delete'
      payroll: PayrollRow
    }
  | null

/**
 * Where the list is shown: `page` is the sidebar's Payrolls → Monthly; `pay-runs` and
 * `history` open beside the Payroll Settings menu, History with only the closed payrolls.
 */
export type MonthlyPayrollVariant = 'page' | 'pay-runs' | 'history'

const VARIANTS: Record<
  MonthlyPayrollVariant,
  { title: string; caption: string; status?: PayrollStatus; create: boolean }
> = {
  page: { title: 'Payrolls Monthly', caption: 'Monthly payrolls', create: true },
  'pay-runs': { title: 'Pay Runs', caption: 'Monthly payrolls', create: true },
  // A new payroll is never closed, so History has no + Create.
  history: {
    title: 'Payroll History',
    caption: 'Closed monthly payrolls',
    status: 'closed',
    create: false,
  },
}

/** Payrolls → Monthly, the sidebar's page: the list with its page in the URL. */
export function MonthlyPayrollPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  return (
    <MonthlyPayrollView
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}

/**
 * The Monthly list (`GET /payroll/payrolls`): month, last run and closing, status and the
 * round action icons; + Create. The route that shows it owns the URL: the sidebar's
 * Payrolls → Monthly, and Pay Runs / Payroll History beside the Payroll Settings menu.
 */
export function MonthlyPayrollView({
  search,
  onSearch,
  variant = 'page',
}: {
  search: PageSearch
  onSearch: (patch: Partial<PageSearch>) => void
  variant?: MonthlyPayrollVariant
}) {
  const shown = VARIANTS[variant]
  const goTo = useNavigate()
  const list = usePayrolls({ page: search.page, pageSize: PAGE_SIZE, status: shown.status })
  const run = useRunPayroll()
  const close = useClosePayroll()
  const hold = useHoldPayroll()
  const remove = useDeletePayroll()
  const [dialog, setDialog] = useState<Dialog>(null)
  const allowed: Record<ActionKey, boolean> = {
    edit: useCan(ACTION_CODES.edit),
    view: useCan(ACTION_CODES.view),
    run: useCan(ACTION_CODES.run),
    close: useCan(ACTION_CODES.close),
    error: useCan(ACTION_CODES.error),
    sheet: useCan(ACTION_CODES.sheet),
    employments: useCan(ACTION_CODES.employments),
    hold: useCan(ACTION_CODES.hold),
    unhold: useCan(ACTION_CODES.unhold),
    delete: useCan(ACTION_CODES.delete),
  }
  const canCreate = useCan('payroll.payrolls.create') && shown.create
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  const failed = (failure: unknown, fallback: string) => {
    toast.error(failure instanceof ApiError ? failure.message : fallback)
  }

  const act = (key: ActionKey, payroll: PayrollRow) => {
    if (key === 'edit' || key === 'view' || key === 'employments' || key === 'delete') {
      setDialog({ type: key, payroll })
    } else if (key === 'error') setDialog({ type: 'errors', payroll })
    else if (key === 'close') setDialog({ type: 'close', payroll })
    else if (key === 'sheet')
      void goTo({ to: '/payroll/salary-sheet', search: { payrollId: payroll.id } })
    else if (key === 'run') {
      run.mutate(payroll.id, {
        onError: (failure) => {
          failed(failure, 'The payroll could not be run.')
        },
      })
    } else {
      hold.mutate(
        { id: payroll.id, hold: key === 'hold' },
        {
          onError: (failure) => {
            failed(failure, 'The payroll could not be changed.')
          },
        },
      )
    }
  }

  const columns: DataTableColumn<PayrollRow>[] = [
    { id: 'code', header: 'Code', cell: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
    {
      id: 'tax',
      header: 'Tax Structure',
      cell: (row) => (
        <span className="block max-w-32 min-w-28 whitespace-normal">
          {row.taxStructureName ?? '—'}
        </span>
      ),
    },
    {
      id: 'month',
      header: 'Month',
      cell: (row) => (row.payrollMonth ? formatMonthComma(row.payrollMonth) : '—'),
    },
    { id: 'employees', header: 'Employees', align: 'center', cell: (row) => row.employeeCount },
    { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable) },
    { id: 'lastRun', header: 'Last Running', cell: (row) => <Stamp value={row.lastRunAt} /> },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <StatusChip {...PAYROLL_STATUS_META[row.status]} />,
    },
    { id: 'lastClose', header: 'Last Closing', cell: (row) => <Stamp value={row.closedAt} /> },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          {ACTIONS_BY_STATUS[row.status]
            .filter((key) => allowed[key])
            .map((key) => {
              const action = ACTIONS[key]
              return (
                <ActionIcon
                  key={key}
                  icon={action.icon}
                  tooltip={action.label}
                  label={`${action.label}, ${row.name}`}
                  colour={action.colour}
                  disabled={
                    (key === 'run' && run.isPending) ||
                    ((key === 'hold' || key === 'unhold') && hold.isPending)
                  }
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
      title={shown.title}
      standalone={variant === 'page'}
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.navy, 'px-5')}
          >
            + Create
          </Button>
        )
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption={shown.caption}
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
              onSearch({ page })
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
          close.mutate(
            { id: dialog.payroll.id, rowVersion: dialog.payroll.rowVersion },
            {
              onError: (failure) => {
                failed(failure, 'The payroll could not be closed.')
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
        title="Delete payroll"
        message={
          dialog?.type === 'delete' && dialog.payroll.payslipCount > 0
            ? `Delete ${dialog.payroll.name}? Its ${String(dialog.payroll.payslipCount)} ${dialog.payroll.payslipCount === 1 ? 'payslip is' : 'payslips are'} deleted with it, and the people on it are no longer paid for ${dialog.payroll.payrollMonth ? formatMonth(dialog.payroll.payrollMonth) : 'the month'}. This cannot be undone.`
            : `Delete ${dialog?.type === 'delete' ? dialog.payroll.name : 'this payroll'}? It has no payslips yet. This cannot be undone.`
        }
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(
            { id: dialog.payroll.id, rowVersion: dialog.payroll.rowVersion },
            {
              onError: (failure) => {
                failed(failure, 'The payroll could not be deleted.')
              },
            },
          )
        }}
      />
    </PayrollCard>
  )
}

/** "September 5, / 2024 04:22 PM" on two lines, as drawn. */
export function Stamp({ value }: { value: string | null }) {
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
