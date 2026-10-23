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
import { cn } from '@/lib/utils'

import { payrollApi, payrollKeys, type PayslipFilters } from '../../api/payroll.api'
import { EMPLOYMENT_STATUS_OPTIONS, PAYSLIP_STATUS_META } from '../../constants'
import {
  useHoldPayslips,
  useMyAccounts,
  usePayrollLookups,
  usePayslip,
  usePayslipAction,
  usePayslips,
} from '../../hooks/use-payroll'
import { PAYSLIP_STATUSES, type PayslipRow } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { type FilterField, type FilterValues, numberOf, useFilters } from '../../utils/filters'
import { formatDayMonth, formatMonth, formatRs } from '../../utils/format'
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

type SlipAction = 'hold' | 'pay' | 'recalculate'
type Dialog =
  | { type: 'view' | 'edit' | 'payslip'; id: string }
  | { type: 'confirm'; action: SlipAction; row: PayslipRow }
  | { type: 'filters' }
  | null

function toParams(values: FilterValues): PayslipFilters {
  return {
    branchId: values.branchId,
    department: values.department,
    employeeId: values.employeeId,
    employmentStatus: values.employmentStatus === 'all' ? undefined : values.employmentStatus,
    status: values.status,
    payrollId: values.payrollId,
    month: values.month,
    earningsFrom: numberOf(values.earningsFrom),
    earningsTo: numberOf(values.earningsTo),
    deductionFrom: numberOf(values.deductionFrom),
    deductionTo: numberOf(values.deductionTo),
    netFrom: numberOf(values.netFrom),
    netTo: numberOf(values.netTo),
  }
}

const CSV_HEADER = [
  'Employee',
  'Employee Code',
  'Month',
  'Earnings',
  'Deduction',
  'Reimbursements',
  'Net Payable',
  'Status',
]
const csvRow = (row: PayslipRow) => [
  row.employee.name,
  row.employee.code,
  formatMonth(row.month),
  row.earnings,
  row.deductions,
  row.reimbursements,
  row.netPayable,
  PAYSLIP_STATUS_META[row.status].label,
]

/** "Employee Accounts" above My pay slips: Provident Fund, EOBI, the outstanding loan. */
function MyAccounts() {
  const accounts = useMyAccounts()
  const rows: [string, number | undefined][] = [
    ['Provident Fund', accounts.data?.providentFund],
    ['EOBI', accounts.data?.eobi],
    ['Outstanding Loan/ Advance Payment', accounts.data?.outstandingLoan],
  ]
  return (
    <section aria-labelledby="my-employee-accounts" className="grid gap-3">
      <h2 id="my-employee-accounts" className="text-xl font-semibold text-title sm:text-2xl">
        Employee Accounts
      </h2>
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
          {rows.map(([label, amount]) => (
            <tr key={label}>
              <td className="px-4 py-3 text-base font-medium text-title sm:px-8 sm:text-lg">
                {label}
              </td>
              <td className="px-4 py-3 text-base font-medium text-title sm:text-lg">
                {amount === undefined ? '…' : formatRs(amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** Which ⋮ entries a pay slip gets, by status (as drawn). */
function actionsFor(
  row: PayslipRow,
  scope: 'my' | 'all',
  open: (dialog: Dialog) => void,
  download: (row: PayslipRow) => void,
): RowAction[] {
  const view: RowAction = {
    label: 'View',
    onSelect: () => {
      open({ type: 'view', id: row.id })
    },
  }
  const payslip: RowAction = {
    label: 'Payslip',
    onSelect: () => {
      open({ type: 'payslip', id: row.id })
    },
  }
  const downloadAction: RowAction = {
    label: 'Download',
    onSelect: () => {
      download(row)
    },
  }
  if (scope === 'my' || row.status === 'released' || row.status === 'released-fs') {
    return [view, payslip, downloadAction]
  }
  const edit: RowAction = {
    label: 'Edit',
    onSelect: () => {
      open({ type: 'edit', id: row.id })
    },
  }
  const confirm = (action: SlipAction, label: string): RowAction => ({
    label,
    onSelect: () => {
      open({ type: 'confirm', action, row })
    },
  })
  return row.status === 'on-hold'
    ? [
        edit,
        view,
        confirm('pay', 'Pay'),
        confirm('recalculate', 'Recalculate'),
        payslip,
        downloadAction,
      ]
    : [
        edit,
        view,
        confirm('hold', 'On Hold'),
        confirm('recalculate', 'Recalculate'),
        payslip,
        downloadAction,
      ]
}

/** A Payslip dialog that loads the slip itself. */
function PayslipDocument({ id, onClose }: { id: string; onClose: () => void }) {
  const slip = usePayslip(id)
  return <PayslipDocumentDialog slip={slip.data} isError={slip.isError} onClose={onClose} />
}

/**
 * Pay Slips. My: the person's Employee Accounts and own slips (Print,
 * Download Excel, Refresh, Filters). All: every slip with ticks for On Hold,
 * Filters, and per-status actions (Edit, View, On Hold / Pay, Recalculate,
 * Payslip, Download).
 */
export function PayslipsPage({ scope }: { scope: 'my' | 'all' }) {
  const route = scope === 'my' ? myRoute : allRoute
  const { page } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useFilters(`payslips-${scope}`)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const lookups = usePayrollLookups()
  const action = usePayslipAction()
  const hold = useHoldPayslips()
  const params = { page, pageSize: PAGE_SIZE, scope, ...toParams(filters) }
  const list = usePayslips(params)
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  const goTo = (next: number) => {
    setSelected(new Set())
    void navigate({ search: { page: next } })
  }

  const allRows = async () => {
    const result = await payrollApi.payslips({ ...params, page: 1, pageSize: 1000 })
    return result.data
  }

  const downloadSlip = (row: PayslipRow) => {
    void payrollApi
      .payslip(row.id)
      .then((slip) => {
        downloadText(
          payslipHtml(slip),
          `payslip-${row.employee.code}-${row.month}.html`,
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

  const columns: DataTableColumn<PayslipRow>[] = [
    ...(scope === 'all'
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
                aria-label={`Select ${row.employee.name}, ${formatMonth(row.month)}`}
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
          {scope === 'all' && (
            <Checkbox
              tone="navy"
              aria-hidden="true"
              tabIndex={-1}
              checked={selected.has(row.id)}
              onCheckedChange={(checked) => {
                toggle(row.id, checked === true)
              }}
              className="md:hidden"
            />
          )}
          <EmployeeAvatar
            name={row.employee.name}
            photoUrl={row.employee.photoUrl}
            className="size-6"
          />
          <span className={personNameText}>{row.employee.name}</span>
        </span>
      ),
    },
    { id: 'month', header: 'Month', cell: (row) => formatDayMonth(row.date) },
    { id: 'earnings', header: 'Earnings', cell: (row) => formatRs(row.earnings) },
    { id: 'deduction', header: 'Deduction', cell: (row) => formatRs(row.deductions) },
    { id: 'reimbursements', header: 'Reimbursements', cell: (row) => formatRs(row.reimbursements) },
    { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable) },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusChip {...PAYSLIP_STATUS_META[row.status]} />,
    },
  ]

  const people = (lookups.data?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: `${person.code} · ${person.designation}`,
  }))
  const payrolls = (lookups.data?.payrolls ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const statuses = PAYSLIP_STATUSES.map((status) => ({
    value: status,
    label: PAYSLIP_STATUS_META[status].label,
  }))
  const filterFields: FilterField[] =
    scope === 'all'
      ? [
          {
            kind: 'select',
            key: 'branchId',
            label: 'Branch',
            placeholder: 'Select Branch',
            options: (lookups.data?.branches ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          },
          {
            kind: 'select',
            key: 'department',
            label: 'Department',
            placeholder: 'Select Department',
            options: (lookups.data?.departments ?? []).map((item) => ({
              value: item,
              label: item,
            })),
          },
          {
            kind: 'select',
            key: 'employeeId',
            label: 'Employees',
            placeholder: 'Select Employee',
            options: people,
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

  return (
    <PayrollCard
      title="Pay Slips"
      actions={
        scope === 'my' ? (
          <>
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
            <Button
              disabled={selected.size === 0 || hold.isPending}
              onClick={() => {
                hold.mutate([...selected], {
                  onSuccess: () => {
                    setSelected(new Set())
                  },
                  onError: () => {
                    toast.error('The pay slips could not be put on hold.')
                  },
                })
              }}
              className={cn(toolbarButton, btn.hold)}
            >
              On Hold
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
            label={`Actions for ${row.employee.name}, ${formatMonth(row.month)}`}
            actions={actionsFor(row, scope, setDialog, downloadSlip)}
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
          preset={`payslips-${scope}`}
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
        title={confirmed ? `${confirmed.action} ${confirmed.row.employee.name}` : undefined}
        onConfirm={() => {
          if (!confirmed) return
          action.mutate(
            { id: confirmed.row.id, action: confirmed.action },
            {
              onError: (error) => {
                toast.error(error instanceof ApiError ? error.message : 'That could not be done.')
              },
            },
          )
        }}
      />
    </PayrollCard>
  )
}
