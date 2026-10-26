import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYSLIP_STATUS_META, REPORT_ROUNDING_LABELS } from '../../constants'
import { usePayrollLookup, useSalarySheet } from '../../hooks/use-payroll'
import type { ReportRounding, SalarySheet, SalarySheetRow } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { formatMonth, formatRs, monthStart } from '../../utils/format'
import { btn, personNameText, toolbarButton } from '../../utils/styles'
import { printHtml, tableHtml } from '../payslips/payslip-html'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'

const routeApi = getRouteApi('/_app/payroll/salary-sheet')

type Totals = SalarySheet['totals']

/** The fixed columns at the end, after the pay items. */
const TOTAL_COLUMNS: { key: keyof Totals; label: [string, string?] }[] = [
  { key: 'totalEarnings', label: ['Total', 'Earnings'] },
  { key: 'totalDeductions', label: ['Total', 'Deductions'] },
  { key: 'totalReimbursements', label: ['Total', 'Reimbursements'] },
  { key: 'netPayable', label: ['Net Pay'] },
]

const GROUPS = [
  { type: 'earning', label: 'Earnings' },
  { type: 'deduction', label: 'Deductions' },
  { type: 'reimbursement', label: 'Reimbursements' },
  { type: 'other', label: 'Other' },
] as const

const groupOf = (itemType: string) =>
  itemType === 'earning' || itemType === 'deduction' || itemType === 'reimbursement'
    ? itemType
    : 'other'

const groupCell = 'px-2 pt-2 pb-3 text-center text-sm font-medium text-title'
const headCell =
  'bg-[#17263A]/[0.06] px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap text-title dark:bg-muted'

const amountOf = (row: SalarySheetRow, payItemId: string) =>
  row.items.find((item) => item.payItemId === payItemId)?.amount ?? 0

/**
 * Salary Sheet (`GET /salary-sheet?payrollId|month`): one row per payslip, a column per pay
 * item grouped under Earnings / Deductions / Reimbursements, then the totals and a Total line.
 * Print (with signature lines when the setting is on), Download Excel (CSV), Refresh, Filters.
 * Amounts come rounded by the API ("Salary Report Rounding").
 */
export function SalarySheetPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtering, setFiltering] = useState(false)
  const payrolls = usePayrollLookup()
  const canExport = useCan('payroll.salary_sheet.export')
  const canPrint = useCan('payroll.salary_sheet.print')
  const latest = payrolls.data?.data.find((payroll) => payroll.kind === 'monthly')
  const payrollId = search.payrollId ?? (search.month ? undefined : latest?.id)
  const sheet = useSalarySheet({
    payrollId,
    month: search.month ? monthStart(search.month) : undefined,
  })
  const data = sheet.data
  const chosen = payrolls.data?.data.find((payroll) => payroll.id === payrollId)
  const title = chosen
    ? `${chosen.name}${chosen.payrollMonth ? ` · ${formatMonth(chosen.payrollMonth)}` : ''}`
    : search.month
      ? formatMonth(search.month)
      : ''
  const columns = data?.columns ?? []
  const grouped = GROUPS.map((group) => ({
    ...group,
    columns: columns.filter((column) => groupOf(column.itemType) === group.type),
  })).filter((group) => group.columns.length > 0)
  const ordered = grouped.flatMap((group) => group.columns)
  const columnTotal = (payItemId: string) =>
    (data?.rows ?? []).reduce((sum, row) => sum + amountOf(row, payItemId), 0)

  const header = [
    'Employee',
    'Employee Code',
    'Payment Method',
    'Status',
    ...ordered.map((column) => column.payItemName),
    ...TOTAL_COLUMNS.map((column) => column.label.join(' ')),
  ]
  const line = (row: SalarySheetRow) => [
    row.employeeName,
    row.employeeCode,
    row.paymentMethod ?? '',
    PAYSLIP_STATUS_META[row.status].label,
    ...ordered.map((column) => amountOf(row, column.payItemId)),
    ...TOTAL_COLUMNS.map((column) => row[column.key]),
  ]
  const totalLine = (totals: Totals) => [
    'Total',
    '',
    '',
    '',
    ...ordered.map((column) => columnTotal(column.payItemId)),
    ...TOTAL_COLUMNS.map((column) => totals[column.key]),
  ]
  const isEmpty = !data || data.rows.length === 0

  return (
    <PayrollCard
      title="Salary Sheet"
      actions={
        <>
          {canPrint && (
            <Button
              disabled={isEmpty}
              onClick={() => {
                if (!data) return
                const show = (cell: string | number) =>
                  typeof cell === 'number' ? formatRs(cell) : cell
                printHtml(
                  tableHtml(
                    `Salary Sheet · ${title}`,
                    header,
                    [
                      ...data.rows.map((row) => line(row).map(show)),
                      totalLine(data.totals).map(show),
                    ],
                    data.printSignature,
                  ),
                )
              }}
              className={cn(toolbarButton, btn.outline, 'text-sm')}
            >
              Print
            </Button>
          )}
          {canExport && (
            <Button
              disabled={isEmpty}
              onClick={() => {
                if (!data) return
                downloadText(
                  toCsv(header, [...data.rows.map(line), totalLine(data.totals)]),
                  `salary-sheet-${search.month ?? chosen?.code ?? 'payroll'}.csv`,
                )
              }}
              className={cn(toolbarButton, btn.blue)}
            >
              Download Excel
            </Button>
          )}
          <Button
            onClick={() => {
              void sheet.refetch()
            }}
            className={cn(toolbarButton, btn.green)}
          >
            Refresh
          </Button>
          <Button
            onClick={() => {
              setFiltering(true)
            }}
            className={cn(toolbarButton, btn.orange)}
          >
            Filters
          </Button>
        </>
      }
    >
      {title && (
        <p className="-mt-2 text-sm text-title">
          {title}
          {data && data.rounding !== 'none' && (
            <span className="ml-2 text-muted-foreground">
              (rounding:{' '}
              {data.rounding in REPORT_ROUNDING_LABELS
                ? REPORT_ROUNDING_LABELS[data.rounding as ReportRounding]
                : data.rounding}
              )
            </span>
          )}
        </p>
      )}

      {!payrollId && !search.month && !payrolls.isPending ? (
        <NoRecord>Choose a payroll or a month in Filters.</NoRecord>
      ) : sheet.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : sheet.isError ? (
        <p role="alert" className="text-sm text-destructive">
          The salary sheet could not be loaded.
        </p>
      ) : isEmpty ? (
        <NoRecord />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table
            aria-label={`Salary Sheet, ${title}`}
            className="w-full min-w-[60rem] text-sm text-title"
          >
            <thead>
              <tr>
                <th scope="colgroup" colSpan={3} className={groupCell}>
                  Employee
                </th>
                {grouped.map((group) => (
                  <th
                    key={group.type}
                    scope="colgroup"
                    colSpan={group.columns.length}
                    className={groupCell}
                  >
                    {group.label}
                  </th>
                ))}
                <th scope="colgroup" colSpan={TOTAL_COLUMNS.length} className={groupCell}>
                  Total
                </th>
              </tr>
              <tr>
                <th scope="col" className={cn(headCell, 'rounded-l-md')}>
                  Employee
                </th>
                <th scope="col" className={headCell}>
                  Payment Method
                </th>
                <th scope="col" className={headCell}>
                  Status
                </th>
                {ordered.map((column) => (
                  <th key={column.payItemId} scope="col" className={headCell}>
                    {column.payItemName}
                  </th>
                ))}
                {TOTAL_COLUMNS.map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(headCell, index === TOTAL_COLUMNS.length - 1 && 'rounded-r-md')}
                  >
                    {column.label[0]}
                    {column.label[1] && <span className="block">{column.label[1]}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.payslipId} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <EmployeeAvatar name={row.employeeName} photoUrl={null} className="size-6" />
                      <span className={personNameText}>
                        {row.employeeName}
                        <span className="block text-[0.625rem] text-grey">{row.employeeCode}</span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-3 capitalize">
                    {(row.paymentMethod ?? '—').replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {PAYSLIP_STATUS_META[row.status].label}
                  </td>
                  {ordered.map((column) => (
                    <td key={column.payItemId} className="px-3 py-3 whitespace-nowrap">
                      {formatRs(amountOf(row, column.payItemId))}
                    </td>
                  ))}
                  {TOTAL_COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                      {formatRs(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <th scope="row" colSpan={3} className="px-3 py-3 text-left">
                  Total
                </th>
                {ordered.map((column) => (
                  <td key={column.payItemId} className="px-3 py-3 whitespace-nowrap">
                    {formatRs(columnTotal(column.payItemId))}
                  </td>
                ))}
                {TOTAL_COLUMNS.map((column) => (
                  <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                    {formatRs(data.totals[column.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {filtering && (
        <FiltersDialog
          preset="salary-sheet"
          mediumLabels
          fields={[
            {
              kind: 'select',
              key: 'payrollId',
              label: 'Payroll',
              placeholder: 'Select Payroll',
              options: (payrolls.data?.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} (${item.code})`,
              })),
            },
            { kind: 'month', key: 'month', label: 'Month' },
          ]}
          value={{ payrollId: search.payrollId, month: search.month }}
          onApply={(values) => {
            void navigate({ search: { payrollId: values.payrollId, month: values.month } })
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
    </PayrollCard>
  )
}
