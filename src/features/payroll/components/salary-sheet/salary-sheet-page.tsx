import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { usePayrollLookups, useSalarySheet } from '../../hooks/use-payroll'
import type { SalarySheet, SalarySheetRow } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { formatMonth, formatRs } from '../../utils/format'
import { btn, personNameText, toolbarButton } from '../../utils/styles'
import { printHtml, tableHtml } from '../payslips/payslip-html'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'

const routeApi = getRouteApi('/_app/payroll/salary-sheet')

type Amounts = SalarySheet['total']

/** The columns after Employee and Payment Method, in the drawn order. */
const AMOUNT_COLUMNS: { key: keyof Amounts; label: [string, string?] }[] = [
  { key: 'grossSalary', label: ['Gross Salary'] },
  { key: 'overtime', label: ['Overtime'] },
  { key: 'tax', label: ['Tax'] },
  { key: 'leaveDeduction', label: ['Leave', 'Deduction'] },
  { key: 'shortDeduction', label: ['Short', 'Deduction'] },
  { key: 'absentDeduction', label: ['Absent', 'Deduction'] },
  { key: 'totalEarnings', label: ['Total', 'Earnings'] },
  { key: 'totalDeductions', label: ['Total', 'Deductions'] },
  { key: 'totalReimbursements', label: ['Total', 'Reimbursements'] },
  { key: 'netPay', label: ['Net Pay'] },
]

const HEADER = [
  'Employee',
  'Employee Code',
  'Payment Method',
  ...AMOUNT_COLUMNS.map((column) => column.label.join(' ')),
]
const line = (row: SalarySheetRow) => [
  row.employee.name,
  row.employee.code,
  row.paymentMethod,
  ...AMOUNT_COLUMNS.map((column) => row[column.key]),
]

const groupCell = 'px-2 pt-2 pb-3 text-center text-sm font-medium text-title'
const headCell =
  'bg-[#17263A]/[0.06] px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap text-title dark:bg-muted'

/**
 * Salary Sheet: one payroll's month, one row per person, grouped under
 * Employee, Earnings, Deductions and Total, with a Total line. Print,
 * Download Excel (CSV), Refresh and Filters (payroll and month).
 */
export function SalarySheetPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtering, setFiltering] = useState(false)
  const lookups = usePayrollLookups()
  const sheet = useSalarySheet({ payrollId: search.payrollId, month: search.month })
  const data = sheet.data
  const title = data?.payroll ? `${data.payroll.name} · ${formatMonth(data.payroll.month)}` : ''

  return (
    <PayrollCard
      title="Salary Sheet"
      actions={
        <>
          <Button
            disabled={!data || data.rows.length === 0}
            onClick={() => {
              if (!data) return
              printHtml(
                tableHtml(`Salary Sheet · ${title}`, HEADER, [
                  ...data.rows.map((row) =>
                    line(row).map((cell) => (typeof cell === 'number' ? formatRs(cell) : cell)),
                  ),
                  [
                    'Total',
                    '',
                    '',
                    ...AMOUNT_COLUMNS.map((column) => formatRs(data.total[column.key])),
                  ],
                ]),
              )
            }}
            className={cn(toolbarButton, btn.outline, 'text-sm')}
          >
            Print
          </Button>
          <Button
            disabled={!data || data.rows.length === 0}
            onClick={() => {
              if (!data) return
              downloadText(
                toCsv(HEADER, [
                  ...data.rows.map(line),
                  ['Total', '', '', ...AMOUNT_COLUMNS.map((column) => data.total[column.key])],
                ]),
                `salary-sheet-${data.payroll?.month ?? 'month'}.csv`,
              )
            }}
            className={cn(toolbarButton, btn.blue)}
          >
            Download Excel
          </Button>
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
      {title && <p className="-mt-2 text-sm text-title">{title}</p>}

      {sheet.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : sheet.isError ? (
        <p role="alert" className="text-sm text-destructive">
          The salary sheet could not be loaded.
        </p>
      ) : !data || data.rows.length === 0 ? (
        <NoRecord />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table
            aria-label={`Salary Sheet, ${title}`}
            className="w-full min-w-[68rem] text-sm text-title"
          >
            <thead>
              <tr>
                <th scope="colgroup" colSpan={2} className={groupCell}>
                  Employee
                </th>
                <th scope="colgroup" colSpan={2} className={groupCell}>
                  Earnings
                </th>
                <th scope="colgroup" colSpan={4} className={groupCell}>
                  Deductions
                </th>
                <th scope="colgroup" colSpan={4} className={groupCell}>
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
                {AMOUNT_COLUMNS.map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(headCell, index === AMOUNT_COLUMNS.length - 1 && 'rounded-r-md')}
                  >
                    {column.label[0]}
                    {column.label[1] && <span className="block">{column.label[1]}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.employee.id} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <EmployeeAvatar
                        name={row.employee.name}
                        photoUrl={row.employee.photoUrl}
                        className="size-6"
                      />
                      <span className={personNameText}>{row.employee.name}</span>
                    </span>
                  </th>
                  <td className="px-3 py-3">{row.paymentMethod}</td>
                  {AMOUNT_COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                      {formatRs(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <th scope="row" colSpan={2} className="px-3 py-3 text-left">
                  Total
                </th>
                {AMOUNT_COLUMNS.map((column) => (
                  <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                    {formatRs(data.total[column.key])}
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
              options: (lookups.data?.payrolls ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            },
            { kind: 'month', key: 'month', label: 'Month' },
          ]}
          value={{
            payrollId: search.payrollId ?? data?.payroll?.id,
            month: search.month ?? data?.payroll?.month,
          }}
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
