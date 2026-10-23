import { type ReactNode, useId, useState } from 'react'
import { format, parse } from 'date-fns'
import { FileWarning } from 'lucide-react'

import { EmployeeAvatar, PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  useEmployeeEarning,
  useExpenseReport,
  usePayrollDashboard,
  usePayrollLookups,
} from '../../hooks/use-payroll'
import type { MonthAmount } from '../../types/payroll.types'
import { formatRs, formatShort } from '../../utils/format'
import { MonthPicker } from '../shared/month-picker'
import { SearchSelect } from '../shared/search-select'
import { AreaChart, BarChart } from './charts'

const monthLabel = (month: string) => format(parse(month, 'yyyy-MM', new Date()), 'MMM')
const monthYear = (month: string) => format(parse(month, 'yyyy-MM', new Date()), 'MMM yyyy')

/** One dashboard card: the title with an optional control on the right, then the content. */
function Panel({
  title,
  control,
  children,
  className,
}: {
  title: string
  control?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'grid min-w-0 content-start gap-4 rounded-xl bg-card p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h2 id={id} className="text-sm font-medium text-heading">
          {title}
        </h2>
        {control}
      </div>
      {children}
    </section>
  )
}

/** "No Record Found!" with the grey document icon, as drawn. */
function Empty() {
  return (
    <div className="grid justify-items-center gap-2 py-6 text-center text-xs text-field-foreground">
      <FileWarning aria-hidden="true" className="size-9 text-label" strokeWidth={1.4} />
      No Record Found!
    </div>
  )
}

const hasData = (rows: readonly MonthAmount[] | undefined) =>
  (rows ?? []).some((row) => row.amount > 0)

/**
 * Payroll → Dashboard: Payroll Comparison Yearly, Expenses Month Wise, the
 * Expense Report for a month, Month Wise Loan & Advance and one person's
 * Employee Month Wise Earning.
 */
export function PayrollDashboardPage() {
  const dashboard = usePayrollDashboard()
  const lookups = usePayrollLookups()
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const report = useExpenseReport(month)
  const people = (lookups.data?.employees ?? []).filter((person) => person.status === 'active')
  const chosen = employeeId ?? people[0]?.id ?? null
  const earning = useEmployeeEarning(chosen)
  const data = dashboard.data
  const [previous, current] = data?.yearly ?? []
  const thisMonth = format(new Date(), 'yyyy-MM')

  return (
    <PageContainer>
      <h1 className="sr-only">Payroll Dashboard</h1>
      <Panel title="Payroll Comparison Yearly">
        {!data || !previous || !current ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <div className="[--series-current:#E0457B] [--series-previous:#D18F00] dark:[--series-previous:#B98000]">
            <AreaChart
              title="Payroll comparison yearly: net pay per month"
              labels={previous.months.map((item) => monthLabel(item.month))}
              format={formatRs}
              series={[
                {
                  key: String(previous.year),
                  label: String(previous.year),
                  colour: 'var(--series-previous)',
                  values: previous.months.map((item) => item.amount),
                  area: true,
                },
                {
                  key: String(current.year),
                  label: String(current.year),
                  colour: 'var(--series-current)',
                  values: current.months.map((item) =>
                    item.month > thisMonth ? null : item.amount,
                  ),
                  area: true,
                },
              ]}
            />
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:gap-5 @4xl/page:grid-cols-2">
        <Panel title="Expenses Month Wise">
          {!data ? (
            <Skeleton className="h-40 w-full" />
          ) : hasData(data.expensesMonthWise) ? (
            <BarChart
              title="Expenses month wise"
              labels={data.expensesMonthWise.map((item) => monthYear(item.month))}
              values={data.expensesMonthWise.map((item) => item.amount)}
              colour="#3B6FF5"
              format={formatRs}
            />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel
          title="Expense Report"
          control={
            <MonthPicker
              aria-label="Expense report month"
              value={month}
              onChange={setMonth}
              max={thisMonth}
              className="h-8 w-44 text-xs"
            />
          }
        >
          {report.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (report.data ?? []).length === 0 ? (
            <Empty />
          ) : (
            <ul className="grid gap-2" aria-label="Expenses this month">
              {(report.data ?? []).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <EmployeeAvatar
                      name={row.employee.name}
                      photoUrl={row.employee.photoUrl}
                      className="size-7"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-heading">{row.employee.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.type} · {formatShort(row.date)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-heading tabular-nums">
                    {formatRs(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 sm:gap-5 @4xl/page:grid-cols-2">
        <Panel title="Month Wise Loan & Advance">
          {!data ? (
            <Skeleton className="h-40 w-full" />
          ) : hasData(data.loanAndAdvance) ? (
            <BarChart
              title="Loans and advances month wise"
              labels={data.loanAndAdvance.map((item) => monthYear(item.month))}
              values={data.loanAndAdvance.map((item) => item.amount)}
              colour="#8B5CF6"
              format={formatRs}
            />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="Employee Month Wise Earning">
          <SearchSelect
            aria-label="Employee"
            value={chosen}
            onChange={setEmployeeId}
            options={people.map((person) => ({
              value: person.id,
              label: person.name,
              hint: person.code,
            }))}
            placeholder="Select Employee"
          />
          {!earning.data ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="[--series-earning:#2CBD4D] dark:[--series-earning:#2FA84F]">
              <AreaChart
                title={`Net pay per month for ${people.find((person) => person.id === chosen)?.name ?? 'the employee'}`}
                labels={earning.data.map((item) => monthYear(item.month))}
                format={formatRs}
                height={220}
                series={[
                  {
                    key: 'earning',
                    label: 'Net pay',
                    colour: 'var(--series-earning)',
                    values: earning.data.map((item) => item.amount),
                    area: true,
                  },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>
    </PageContainer>
  )
}
