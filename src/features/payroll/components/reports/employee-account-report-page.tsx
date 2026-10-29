import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import type { ReportFilters } from '../../api/payroll.api'
import {
  PAY_ITEM_TYPE_LABELS,
  PAYROLL_STATUS_META,
  PAYSLIP_STATUS_META,
  RELEASED_WITH_FS_META,
} from '../../constants'
import {
  useDailyWagesReport,
  useEmployeeAccountReport,
  useEmployeeWiseReport,
  usePayrollLookup,
  usePayrollSummary,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { ReportSearch } from '../../routing'
import type {
  DailyWagesReportRow,
  EmployeeAccountReportRow,
  EmployeeWiseRow,
} from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { activeCount, type FilterField, type FilterValues, useFilters } from '../../utils/filters'
import { formatLong, formatMonth, formatRs, hours, monthStart } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { SearchSelect } from '../shared/search-select'

const routeApi = getRouteApi('/_app/payroll/reports/employee-accounts')
const PAGE_SIZE = 10

type Report = ReportSearch['report']
const REPORTS: { key: Report; label: string }[] = [
  { key: 'accounts', label: 'Employee Accounts' },
  { key: 'employee-wise', label: 'Employee Wise' },
  { key: 'daily-wages', label: 'Daily Wages Summary' },
  { key: 'summary', label: 'Payroll Summary' },
]

const accountColumns: DataTableColumn<EmployeeAccountReportRow>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => (
      <span className="grid">
        <PersonCell person={{ name: row.employeeName, photoUrl: null }} />
        <span className="text-[0.625rem] text-grey">
          {row.employeeCode}
          {row.departmentName ? ` · ${row.departmentName}` : ''}
        </span>
      </span>
    ),
  },
  {
    id: 'accounts',
    header: 'Accounts (balance)',
    cell: (row) =>
      row.accounts.length === 0 ? (
        '—'
      ) : (
        <span className="grid gap-0.5 whitespace-nowrap">
          {row.accounts.map((account) => (
            <span key={account.accountTypeId}>
              {account.accountName}: {formatRs(account.balance)}
            </span>
          ))}
        </span>
      ),
  },
  {
    id: 'rebate',
    header: 'Total Tax Rebate',
    align: 'center',
    cell: (row) => formatRs(row.taxRebate),
  },
  { id: 'tax', header: 'Total Tax Paid', align: 'center', cell: (row) => formatRs(row.taxPaid) },
]

const money = (value: number | null) => formatRs(value ?? 0)

/** A status as the lists label it ("On Hold", "Run"), not the API's code. */
const statusLabel = (meta: Record<string, { label: string }>, status: string) =>
  meta[status]?.label ?? status.replace(/_/g, ' ')

const employeeWiseColumns: DataTableColumn<EmployeeWiseRow>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => (
      <span className="grid">
        <PersonCell person={{ name: row.employeeName, photoUrl: null }} />
        <span className="text-[0.625rem] text-grey">{row.employeeCode}</span>
      </span>
    ),
  },
  { id: 'month', header: 'Month', cell: (row) => formatMonth(row.payslipMonth) },
  {
    id: 'payroll',
    header: 'Payroll',
    cell: (row) => row.payrollName ?? (row.isFinalSettlement ? 'Final Settlement' : '—'),
  },
  { id: 'gross', header: 'Gross', cell: (row) => money(row.gross) },
  { id: 'earnings', header: 'Earnings', cell: (row) => money(row.totalEarnings) },
  { id: 'deductions', header: 'Deductions', cell: (row) => money(row.totalDeductions) },
  { id: 'tax', header: 'Tax', cell: (row) => money(row.taxAmount) },
  { id: 'net', header: 'Net Payable', cell: (row) => money(row.netPayable) },
  {
    id: 'status',
    header: 'Status',
    cell: (row) =>
      row.status === 'released' && row.isFinalSettlement
        ? RELEASED_WITH_FS_META.label
        : statusLabel(PAYSLIP_STATUS_META, row.status),
  },
]

const dailyWagesColumns: DataTableColumn<DailyWagesReportRow>[] = [
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => `${row.name} (${row.code})` },
  { id: 'date', header: 'Date', cell: (row) => formatLong(row.workDate) },
  { id: 'slot', header: 'Time Slot', cell: (row) => row.timeSlotName ?? '—' },
  { id: 'employees', header: 'Employees', align: 'center', cell: (row) => row.employeeCount },
  { id: 'worked', header: 'Worked', cell: (row) => hours(row.workedMinutes) },
  { id: 'net', header: 'Net Payable', cell: (row) => formatRs(row.netPayable) },
  {
    id: 'vouchers',
    header: 'Vouchers (verified)',
    align: 'center',
    cell: (row) => `${row.voucherCount} (${row.vouchersProcessed})`,
  },
  { id: 'status', header: 'Status', cell: (row) => statusLabel(PAYROLL_STATUS_META, row.status) },
]

/** The filters as the report endpoints take them (`from` / `to` are months or days). */
function toReportFilters(values: FilterValues, months: boolean): ReportFilters {
  const day = (value: string | undefined) =>
    value && months ? monthStart(value.slice(0, 7)) : value
  return {
    from: day(values.from),
    to: day(values.to),
    departmentId: values.departmentId,
    employeeId: values.employeeId,
  }
}

/**
 * Reports. Employee Accounts (`/reports/employee-accounts`: each person's account balances,
 * tax rebates and tax paid), Employee Wise (`/reports/employee-wise`: payslips by person and
 * month), Daily Wages Summary (`/reports/daily-wages`) and Payroll Summary
 * (`/reports/payroll-summary/{payrollId}`), as tabs of the one Reports page.
 */
export function EmployeeAccountReportPage() {
  const { page, report } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const allowed = useCan('payroll.reports.view')
  const canExport = useCan('payroll.reports.export')
  const options = usePayrollOptions('payroll.reports.view')
  const [filters, setFilters] = useFilters(`payroll-report-${report}`)
  const [filtering, setFiltering] = useState(false)
  const [payrollId, setPayrollId] = useState<string | null>(null)
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const base = { page, pageSize: PAGE_SIZE, q: filters.q }
  const accounts = useEmployeeAccountReport({ ...base, ...toReportFilters(filters, false) })
  const employeeWise = useEmployeeWiseReport({ ...base, ...toReportFilters(filters, true) })
  const dailyWages = useDailyWagesReport({ ...base, ...toReportFilters(filters, false) })
  const payrolls = usePayrollLookup()
  const summary = usePayrollSummary(report === 'summary' ? payrollId : null)

  const fields: FilterField[] =
    report === 'daily-wages'
      ? [
          { kind: 'date', key: 'from', label: 'From' },
          { kind: 'date', key: 'to', label: 'To' },
        ]
      : [
          { kind: 'text', key: 'q', label: 'Search' },
          ...(report === 'employee-wise'
            ? [
                {
                  kind: 'employee' as const,
                  key: 'employeeId',
                  label: 'Employees',
                  placeholder: 'Select Employees',
                  filters: options.employeeFilters,
                },
                { kind: 'month' as const, key: 'from', label: 'From Month' },
                { kind: 'month' as const, key: 'to', label: 'To Month' },
              ]
            : [
                { kind: 'date' as const, key: 'from', label: 'From' },
                { kind: 'date' as const, key: 'to', label: 'To' },
              ]),
          {
            kind: 'select',
            key: 'departmentId',
            label: 'Department',
            placeholder: 'Select Department',
            options: options.departments,
          },
        ]

  const download = () => {
    if (report === 'accounts') {
      downloadText(
        toCsv(
          ['Employee', 'Code', 'Department', 'Accounts', 'Tax Rebate', 'Tax Paid'],
          (accounts.data?.data ?? []).map((row) => [
            row.employeeName,
            row.employeeCode,
            row.departmentName ?? '',
            row.accounts.map((account) => `${account.accountName}: ${account.balance}`).join('; '),
            row.taxRebate,
            row.taxPaid,
          ]),
        ),
        'employee-account-report.csv',
      )
    } else if (report === 'employee-wise') {
      downloadText(
        toCsv(
          ['Employee', 'Code', 'Month', 'Payroll', 'Gross', 'Earnings', 'Deductions', 'Tax', 'Net'],
          (employeeWise.data?.data ?? []).map((row) => [
            row.employeeName,
            row.employeeCode,
            row.payslipMonth,
            row.payrollName ?? '',
            row.gross ?? 0,
            row.totalEarnings ?? 0,
            row.totalDeductions ?? 0,
            row.taxAmount ?? 0,
            row.netPayable ?? 0,
          ]),
        ),
        'employee-wise-report.csv',
      )
    } else if (report === 'daily-wages') {
      downloadText(
        toCsv(
          ['Name', 'Code', 'Date', 'Time Slot', 'Employees', 'Net Payable', 'Vouchers', 'Status'],
          (dailyWages.data?.data ?? []).map((row) => [
            row.name,
            row.code,
            row.workDate,
            row.timeSlotName ?? '',
            row.employeeCount,
            row.netPayable,
            row.voucherCount,
            statusLabel(PAYROLL_STATUS_META, row.status),
          ]),
        ),
        'daily-wages-report.csv',
      )
    } else if (summary.data) {
      downloadText(
        toCsv(
          ['Pay Item', 'Type', 'Employees', 'Amount', 'Employer Contribution'],
          summary.data.payItems.map((item) => [
            item.payItemName,
            item.itemType,
            item.employeeCount,
            item.amount,
            item.employerContribution,
          ]),
        ),
        `payroll-summary-${summary.data.code}.csv`,
      )
    }
  }

  if (!allowed) {
    return (
      <PayrollCard title="Reports">
        <p className="text-sm text-muted-foreground">You do not have access to payroll reports.</p>
      </PayrollCard>
    )
  }

  const title = REPORTS.find((item) => item.key === report)?.label ?? ''
  return (
    <PayrollCard
      title={report === 'accounts' ? 'Employee Account Report' : `${title} Report`}
      actions={
        <>
          {canExport && (
            <Button onClick={download} className={cn(toolbarButton, btn.blue)}>
              Download Excel
            </Button>
          )}
          {report !== 'summary' && (
            <FiltersButton
              count={activeCount(filters)}
              onClick={() => {
                setFiltering(true)
              }}
            />
          )}
        </>
      }
    >
      <div role="tablist" aria-label="Reports" className="flex flex-wrap gap-2">
        {REPORTS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={report === item.key}
            onClick={() => {
              // The open tab is kept in the URL (`?report=`), so a reload or a shared link keeps it.
              setFilters({})
              void navigate({ search: (prev) => ({ ...prev, report: item.key, page: 1 }) })
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              report === item.key
                ? 'bg-[#17263A] text-white dark:bg-primary'
                : 'bg-muted text-title',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {report === 'accounts' && (
        <>
          <DataTable
            columns={accountColumns}
            data={accounts.data?.data ?? []}
            getRowId={(row) => row.employeeId}
            caption="Employee account report"
            isLoading={accounts.isPending}
            isFetching={accounts.isFetching}
            // Figma: this report's headings are Poppins Medium 16 #303030.
            className={cn(payrollTableClass, '[&_th]:text-base')}
            emptyState={<NoRecord />}
          />
          <ListFooter
            meta={accounts.data?.meta}
            noun="employees"
            disabled={accounts.isFetching}
            onPageChange={goTo}
          />
        </>
      )}
      {report === 'employee-wise' && (
        <>
          <DataTable
            columns={employeeWiseColumns}
            data={employeeWise.data?.data ?? []}
            getRowId={(row) => row.payslipId}
            caption="Employee wise report"
            isLoading={employeeWise.isPending}
            isFetching={employeeWise.isFetching}
            className={payrollTableClass}
            emptyState={<NoRecord />}
          />
          <ListFooter
            meta={employeeWise.data?.meta}
            noun="payslips"
            disabled={employeeWise.isFetching}
            onPageChange={goTo}
          />
        </>
      )}
      {report === 'daily-wages' && (
        <>
          <DataTable
            columns={dailyWagesColumns}
            data={dailyWages.data?.data ?? []}
            getRowId={(row) => row.payrollId}
            caption="Daily wages summary"
            isLoading={dailyWages.isPending}
            isFetching={dailyWages.isFetching}
            className={payrollTableClass}
            emptyState={<NoRecord />}
          />
          <ListFooter
            meta={dailyWages.data?.meta}
            noun="payrolls"
            disabled={dailyWages.isFetching}
            onPageChange={goTo}
          />
        </>
      )}
      {report === 'summary' && (
        <div className="grid gap-4">
          <SearchSelect
            aria-label="Payroll"
            value={payrollId}
            onChange={setPayrollId}
            options={(payrolls.data?.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.name} (${item.code})`,
            }))}
            placeholder="Select Payroll"
            className="max-w-md"
          />
          {!payrollId ? (
            <NoRecord>Choose a payroll.</NoRecord>
          ) : !summary.data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                {(
                  [
                    ['Employees', String(summary.data.employeeCount)],
                    ['Gross', formatRs(summary.data.gross)],
                    ['Earnings', formatRs(summary.data.totalEarnings)],
                    ['Deductions', formatRs(summary.data.totalDeductions)],
                    ['Reimbursements', formatRs(summary.data.totalReimbursements)],
                    ['Tax', formatRs(summary.data.tax)],
                    ['Net Payable', formatRs(summary.data.netPayable)],
                    ['Paid', formatRs(summary.data.paidAmount)],
                    [
                      'On Hold',
                      `${summary.data.onHoldCount} · ${formatRs(summary.data.onHoldAmount)}`,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted/60 px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-semibold text-heading tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {summary.data.payItems.length === 0 ? (
                <NoRecord />
              ) : (
                <table className={cn('w-full text-left', payrollTableClass)}>
                  <caption className="sr-only">Pay item totals</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pay Item</th>
                      <th scope="col">Type</th>
                      <th scope="col">Employees</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Employer Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.payItems.map((item) => (
                      <tr key={item.payItemId}>
                        <td>{item.payItemName}</td>
                        <td>{PAY_ITEM_TYPE_LABELS[item.itemType]}</td>
                        <td>{item.employeeCount}</td>
                        <td>{formatRs(item.amount)}</td>
                        <td>{formatRs(item.employerContribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      {filtering && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset={`payroll-report-${report}`}
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
    </PayrollCard>
  )
}
