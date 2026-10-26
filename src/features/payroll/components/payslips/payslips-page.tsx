import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  EmployeeAvatar,
  Pagination,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { payrollApi, payrollKeys, type PayslipFilters } from '../../api/payroll.api'
import {
  ACCOUNT_CATEGORY_LABELS,
  EMPLOYMENT_STATUS_OPTIONS,
  PAYSLIP_STATUS_META,
  RELEASED_WITH_FS_META,
} from '../../constants'
import {
  type PayslipAction,
  useMyAccounts,
  usePayrollLookup,
  usePayslip,
  usePayslipAction,
  usePayslips,
  usePayslipsBulk,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import { PAYSLIP_STATUSES, type PayslipRow } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { type FilterField, type FilterValues, numberOf, useFilters } from '../../utils/filters'
import { formatMonth, formatRs, monthStart } from '../../utils/format'
import { btn, payrollTableClass, personNameText, toolbarButton } from '../../utils/styles'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { PayrollCard } from '../shared/payroll-card'
import { StatusChip } from '../shared/status-chip'
import { PayslipDialog } from './payslip-dialog'
import { PayslipDocumentDialog } from './payslip-document'
import { payslipHtml, printHtml, tableHtml } from './payslip-html'

const myRoute = getRouteApi('/_app/payroll/pay-slips/my')
const allRoute = getRouteApi('/_app/payroll/pay-slips/all')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'view' | 'edit' | 'payslip'; id: string }
  | { type: 'confirm'; action: PayslipAction; row: PayslipRow }
  | { type: 'bulk'; action: PayslipAction }
  | { type: 'filters' }
  | null

const ACTION_LABELS: Record<PayslipAction, string> = {
  hold: 'On Hold',
  unhold: 'Release Hold',
  pay: 'Mark Paid',
  recalculate: 'Recalculate',
}

function toParams(values: FilterValues): PayslipFilters {
  return {
    branchId: values.branchId,
    departmentId: values.departmentId,
    employeeId: values.employeeId,
    employmentStatus: values.employmentStatus === 'all' ? undefined : values.employmentStatus,
    status: values.status,
    payrollId: values.payrollId,
    month: values.month ? monthStart(values.month) : undefined,
    finalSettlement:
      values.finalSettlement === 'yes' ? true : values.finalSettlement === 'no' ? false : undefined,
    earningsFrom: numberOf(values.earningsFrom),
    earningsTo: numberOf(values.earningsTo),
    deductionFrom: numberOf(values.deductionFrom),
    deductionTo: numberOf(values.deductionTo),
    netFrom: numberOf(values.netFrom),
    netTo: numberOf(values.netTo),
  }
}

const chipOf = (row: PayslipRow) =>
  row.status === 'released' && row.isFinalSettlement
    ? RELEASED_WITH_FS_META
    : PAYSLIP_STATUS_META[row.status]

const CSV_HEADER = [
  'Employee',
  'Employee Code',
  'Payroll',
  'Month',
  'Earnings',
  'Deduction',
  'Reimbursements',
  'Tax',
  'Net Payable',
  'Status',
  'Paid',
]
const csvRow = (row: PayslipRow) => [
  row.employeeName,
  row.employeeCode,
  row.payrollName ?? (row.isFinalSettlement ? 'Final Settlement' : ''),
  formatMonth(row.payslipMonth),
  row.totalEarnings ?? 0,
  row.totalDeductions ?? 0,
  row.totalReimbursements ?? 0,
  row.taxAmount ?? 0,
  row.netPayable ?? 0,
  chipOf(row).label,
  row.paidAt ? 'Yes' : 'No',
]

/**
 * "Employee Accounts" above My pay slips (`GET /payslips/summary`): each account's balance,
 * the outstanding loan and the advances paid.
 */
function MyAccounts() {
  const accounts = useMyAccounts()
  const data = accounts.data
  const rows: [string, number | null | undefined][] = data
    ? [
        ...data.accounts.map((account): [string, number] => [
          `${account.accountName} (${ACCOUNT_CATEGORY_LABELS[account.category]})`,
          account.balance,
        ]),
        ['Outstanding Loan', data.outstandingLoan ?? 0],
        ['Advance Payments', data.advancesPaid ?? 0],
      ]
    : []
  return (
    <section aria-labelledby="my-employee-accounts" className="grid gap-3">
      <h2 id="my-employee-accounts" className="text-xl font-semibold text-title sm:text-2xl">
        Employee Accounts
      </h2>
      {accounts.isError ? (
        <p className="text-sm text-muted-foreground">
          {accounts.error instanceof ApiError
            ? accounts.error.message
            : 'Your accounts could not be loaded.'}
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Employee Accounts</caption>
          <thead>
            <tr className="bg-[#17263A]/[0.06] text-left text-base text-title dark:bg-muted">
              <th scope="col" className="rounded-l-md px-4 py-2.5 font-medium sm:px-8">
                Accounts
              </th>
              <th scope="col" className="w-1/3 rounded-r-md px-4 py-2.5 font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.isPending ? (
              <tr>
                <td className="px-4 py-3 sm:px-8">…</td>
                <td className="px-4 py-3">…</td>
              </tr>
            ) : (
              rows.map(([label, amount]) => (
                <tr key={label}>
                  <td className="px-4 py-3 text-base font-medium text-title sm:px-8 sm:text-lg">
                    {label}
                  </td>
                  <td className="px-4 py-3 text-base font-medium text-title sm:text-lg">
                    {formatRs(amount ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}

interface Allowed {
  edit: boolean
  process: boolean
  download: boolean
}

/**
 * Which ⋮ entries a pay slip gets, by status: hand edits only before release (and never on
 * daily-wage slips), hold on a ready slip, release hold on a held one, Mark Paid on a ready or
 * released unpaid one, recalculate before release.
 */
function actionsFor(
  row: PayslipRow,
  scope: 'my' | 'all',
  allowed: Allowed,
  open: (dialog: Dialog) => void,
  download: (row: PayslipRow) => void,
): RowAction[] {
  const entry = (label: string, dialog: Dialog): RowAction => ({
    label,
    onSelect: () => {
      open(dialog)
    },
  })
  const view = entry('View', { type: 'view', id: row.id })
  const payslip = entry('Payslip', { type: 'payslip', id: row.id })
  const downloadAction: RowAction = {
    label: 'Download',
    onSelect: () => {
      download(row)
    },
  }
  const tail = [payslip, ...(allowed.download ? [downloadAction] : [])]
  if (scope === 'my') return [view, ...tail]
  const confirm = (action: PayslipAction) =>
    entry(ACTION_LABELS[action], { type: 'confirm', action, row })
  const editable =
    allowed.edit &&
    row.status !== 'released' &&
    row.payrollStatus !== 'closed' &&
    row.payrollKind !== 'daily_wage'
  const actions: RowAction[] = []
  if (editable) actions.push(entry('Edit', { type: 'edit', id: row.id }))
  actions.push(view)
  if (allowed.edit && row.status === 'ready') actions.push(confirm('hold'))
  if (allowed.edit && row.status === 'on_hold') actions.push(confirm('unhold'))
  if (allowed.process && row.status !== 'on_hold' && !row.paidAt) actions.push(confirm('pay'))
  if (allowed.process && row.status !== 'released' && row.payrollStatus !== 'closed') {
    actions.push(confirm('recalculate'))
  }
  return [...actions, ...tail]
}

/** A Payslip dialog that loads the slip itself. */
function PayslipDocument({
  id,
  canPrint,
  onClose,
}: {
  id: string
  canPrint: boolean
  onClose: () => void
}) {
  const slip = usePayslip(id)
  return (
    <PayslipDocumentDialog
      slip={slip.data}
      isError={slip.isError}
      canPrint={canPrint}
      onClose={onClose}
    />
  )
}

/**
 * Pay Slips (`GET /payslips?scope=my|all`). My: the person's Employee Accounts and own slips
 * (Print, Download Excel, Refresh, Filters). All: every slip the caller reaches, with ticks for
 * the bulk actions (On Hold, Release Hold, Mark Paid, Recalculate), Filters, and per-status
 * actions.
 */
export function PayslipsPage({ scope }: { scope: 'my' | 'all' }) {
  const route = scope === 'my' ? myRoute : allRoute
  const { page } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useFilters(`payslips-${scope}-v2`)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const options = usePayrollOptions('payroll.payslips.view')
  const payrollList = usePayrollLookup()
  const action = usePayslipAction()
  const bulk = usePayslipsBulk()
  const allowed: Allowed = {
    edit: useCan('payroll.payslips.edit'),
    process: useCan('payroll.payslips.process'),
    download: useCan('payroll.payslips.download'),
  }
  const canPrint = useCan('payroll.payslips.print')
  const canExport = useCan('payroll.payslips.export')
  const params = { page, pageSize: PAGE_SIZE, scope, ...toParams(filters) }
  const list = usePayslips(params)
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  const goTo = (next: number) => {
    setSelected(new Set())
    void navigate({ search: { page: next } })
  }

  /** Every page of the current filter (the API serves 100 a page). */
  const allRows = async () => {
    const first = await payrollApi.payslips({ ...params, page: 1, pageSize: 100 })
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) =>
        payrollApi.payslips({ ...params, page: index + 2, pageSize: 100 }),
      ),
    )
    return [first, ...rest].flatMap((result) => result.data)
  }

  const downloadSlip = (row: PayslipRow) => {
    void payrollApi
      .payslip(row.id)
      .then((slip) => {
        downloadText(
          payslipHtml(slip),
          `payslip-${row.employeeCode}-${row.payslipMonth.slice(0, 7)}.html`,
          'text/html;charset=utf-8',
        )
      })
      .catch(() => {
        toast.error('The pay slip could not be downloaded.')
      })
  }

  const toggle = (id: string, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const allTicked = rows.length > 0 && rows.every((row) => selected.has(row.id))
  const bulkActions = (
    [
      ['hold', allowed.edit],
      ['unhold', allowed.edit],
      ['pay', allowed.process],
      ['recalculate', allowed.process],
    ] as const
  ).filter(([, can]) => can)

  const columns: DataTableColumn<PayslipRow>[] = [
    ...(scope === 'all' && bulkActions.length > 0
      ? [
          {
            id: 'select',
            header: (
              <Checkbox
                tone="navy"
                aria-label="Select all pay slips on this page"
                checked={allTicked}
                disabled={rows.length === 0}
                onCheckedChange={(checked) => {
                  setSelected(checked === true ? new Set(rows.map((row) => row.id)) : new Set())
                }}
              />
            ),
            className: 'w-10',
            mobile: 'hidden' as const,
            cell: (row: PayslipRow) => (
              <Checkbox
                tone="navy"
                aria-label={`Select ${row.employeeName}, ${formatMonth(row.payslipMonth)}`}
                checked={selected.has(row.id)}
                onCheckedChange={(checked) => {
                  toggle(row.id, checked === true)
                }}
              />
            ),
          },
        ]
      : []),
    {
      id: 'employee',
      header: 'Employee',
      mobile: 'heading',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <EmployeeAvatar name={row.employeeName} photoUrl={null} className="size-6" />
          <span className={personNameText}>
            {row.employeeName}
            <span className="block text-[0.5625rem] font-normal text-grey">{row.employeeCode}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'payroll',
      header: 'Payroll',
      cell: (row) => row.payrollName ?? (row.isFinalSettlement ? 'Final Settlement' : '—'),
    },
    { id: 'month', header: 'Month', cell: (row) => formatMonth(row.payslipMonth) },
    { id: 'earnings', header: 'Earnings', cell: (row) => formatRs(row.totalEarnings ?? 0) },
    { id: 'deduction', header: 'Deduction', cell: (row) => formatRs(row.totalDeductions ?? 0) },
    {
      id: 'reimbursements',
      header: 'Reimbursements',
      cell: (row) => formatRs(row.totalReimbursements ?? 0),
    },
    { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable ?? 0) },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="grid justify-items-start gap-1">
          <StatusChip {...chipOf(row)} />
          {row.paidAt && <span className="text-[0.625rem] text-[#51B969]">Paid</span>}
        </span>
      ),
    },
  ]

  const statuses = PAYSLIP_STATUSES.map((status) => ({
    value: status,
    label: PAYSLIP_STATUS_META[status].label,
  }))
  const payrolls = (payrollList.data?.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.code})`,
  }))
  const filterFields: FilterField[] =
    scope === 'all'
      ? [
          {
            kind: 'select',
            key: 'branchId',
            label: 'Branch',
            placeholder: 'Select Branch',
            options: options.branches,
          },
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
            label: 'Employees',
            placeholder: 'Select Employee',
            filters: options.employeeFilters,
          },
          {
            kind: 'select',
            key: 'employmentStatus',
            label: 'Employment Status',
            placeholder: 'Select an Option',
            options: EMPLOYMENT_STATUS_OPTIONS,
          },
          {
            kind: 'select',
            key: 'status',
            label: 'Status',
            placeholder: 'Status',
            options: statuses,
          },
          {
            kind: 'range',
            key: 'earnings',
            label: 'Earnings',
            from: 'earningsFrom',
            to: 'earningsTo',
          },
          {
            kind: 'select',
            key: 'payrollId',
            label: 'Payroll',
            placeholder: 'Select Payroll',
            options: payrolls,
          },
          {
            kind: 'range',
            key: 'deduction',
            label: 'Deduction',
            from: 'deductionFrom',
            to: 'deductionTo',
          },
          { kind: 'month', key: 'month', label: 'Month' },
          { kind: 'range', key: 'net', label: 'Net Payable', from: 'netFrom', to: 'netTo' },
          {
            kind: 'select',
            key: 'finalSettlement',
            label: 'Final Settlement',
            placeholder: 'Any',
            options: [
              { value: 'yes', label: 'Final settlement slips' },
              { value: 'no', label: 'Payroll slips' },
            ],
          },
        ]
      : [
          {
            kind: 'select',
            key: 'payrollId',
            label: 'Payroll',
            placeholder: 'Select Payroll',
            options: payrolls,
          },
          {
            kind: 'select',
            key: 'status',
            label: 'Status',
            placeholder: 'Status',
            options: statuses,
          },
          { kind: 'month', key: 'month', label: 'Month' },
          { kind: 'range', key: 'net', label: 'Net Payable', from: 'netFrom', to: 'netTo' },
        ]

  const confirmed = dialog?.type === 'confirm' ? dialog : null
  const bulkDialog = dialog?.type === 'bulk' ? dialog : null
  const failed = (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : 'That could not be done.')
  }

  return (
    <PayrollCard
      title="Pay Slips"
      actions={
        scope === 'my' ? (
          <>
            {canPrint && (
              <Button
                onClick={() => {
                  void allRows().then((data) => {
                    printHtml(
                      tableHtml(
                        'Pay Slips',
                        CSV_HEADER,
                        data.map((row) => csvRow(row).map(String)),
                      ),
                    )
                  })
                }}
                className={cn(toolbarButton, btn.outline, 'text-sm')}
              >
                Print
              </Button>
            )}
            {canExport && (
              <Button
                onClick={() => {
                  void allRows().then((data) => {
                    downloadText(toCsv(CSV_HEADER, data.map(csvRow)), 'my-pay-slips.csv')
                  })
                }}
                className={cn(toolbarButton, btn.blue)}
              >
                Download Excel
              </Button>
            )}
            <Button
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: payrollKeys.all })
              }}
              className={cn(toolbarButton, btn.green)}
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                setDialog({ type: 'filters' })
              }}
              className={cn(toolbarButton, btn.orange)}
            >
              Filters
            </Button>
          </>
        ) : (
          <>
            {bulkActions.map(([key]) => (
              <Button
                key={key}
                disabled={selected.size === 0 || bulk.isPending}
                onClick={() => {
                  setDialog({ type: 'bulk', action: key })
                }}
                className={cn(toolbarButton, key === 'hold' ? btn.hold : btn.navy)}
              >
                {ACTION_LABELS[key]}
              </Button>
            ))}
            {canExport && (
              <Button
                onClick={() => {
                  void allRows().then((data) => {
                    downloadText(toCsv(CSV_HEADER, data.map(csvRow)), 'pay-slips.csv')
                  })
                }}
                className={cn(toolbarButton, btn.blue)}
              >
                Download Excel
              </Button>
            )}
            <Button
              onClick={() => {
                setDialog({ type: 'filters' })
              }}
              className={cn(toolbarButton, btn.orange)}
            >
              Filters
            </Button>
          </>
        )
      }
    >
      {scope === 'my' && <MyAccounts />}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption={scope === 'my' ? 'My pay slips' : 'Pay slips'}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState="No pay slips match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employeeName}, ${formatMonth(row.payslipMonth)}`}
            actions={actionsFor(row, scope, allowed, setDialog, downloadSlip)}
          />
        )}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            disabled={list.isFetching}
            onPageChange={goTo}
          />
        </div>
      )}

      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={filterFields}
          value={filters}
          preset={`payslips-${scope}-v2`}
          layout={scope === 'all' ? 'grid' : 'rows'}
          mediumLabels
          onApply={(values) => {
            setFilters(values)
            goTo(1)
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {(dialog?.type === 'view' || dialog?.type === 'edit') && (
        <PayslipDialog
          payslipId={dialog.id}
          mode={dialog.type}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'payslip' && (
        <PayslipDocument
          id={dialog.id}
          canPrint={canPrint}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmAction
        open={confirmed !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        message="Are you sure you want to Perform this action?"
        title={
          confirmed ? `${ACTION_LABELS[confirmed.action]} ${confirmed.row.employeeName}` : undefined
        }
        onConfirm={() => {
          if (!confirmed) return
          action.mutate({ id: confirmed.row.id, action: confirmed.action }, { onError: failed })
        }}
      />
      <ConfirmAction
        open={bulkDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        message={`${bulkDialog ? ACTION_LABELS[bulkDialog.action] : ''}: ${selected.size} pay slip${selected.size === 1 ? '' : 's'}?`}
        title={
          bulkDialog ? `${ACTION_LABELS[bulkDialog.action]} the selected pay slips` : undefined
        }
        onConfirm={() => {
          if (!bulkDialog) return
          bulk.mutate(
            { ids: [...selected], action: bulkDialog.action },
            {
              onSuccess: (result) => {
                setSelected(new Set())
                if (result.errors.length > 0) toast.warning(result.errors.join(' '))
              },
              onError: failed,
            },
          )
        }}
      />
    </PayrollCard>
  )
}
