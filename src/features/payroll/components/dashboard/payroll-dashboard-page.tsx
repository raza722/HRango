import { type ReactNode, useId, useState } from 'react'
import { format, parseISO } from 'date-fns'

import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { EmployeeLookupFilters } from '@/hooks/use-employee-lookup'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAY_ITEM_TYPE_LABELS } from '../../constants'
import { usePayrollDashboard } from '../../hooks/use-payroll'
import {
  useEmployeeEarnings,
  useLatestPayslip,
  useLoanMonths,
} from '../../hooks/use-payroll-dashboard'
import type { PayrollDashboard } from '../../types/payroll.types'
import { formatMonth, formatRs, monthOf, monthStart } from '../../utils/format'
import { EmployeeSearchSelect } from '../shared/employee-search-select'
import { MonthPicker } from '../shared/month-picker'
import { AreaChart, ColumnChart } from './charts'

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2024, index, 1), 'MMM'),
)

/** The drawn series colours (the chart library's amber and green in the frame). */
const AMBER = '#FFB200'
const GREEN = '#00AC49'

/** The earnings picker: everyone with payslips the caller may read, former staff too. */
const EARNING_PEOPLE: EmployeeLookupFilters = {
  permission: 'payroll.payslips.view',
  includeInactive: true,
}

/** One dashboard card as drawn: the title over a dashed rule, an optional control on its right. */
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
        'grid min-w-0 content-start rounded-lg bg-card shadow-[0_1px_4px_rgba(16,24,40,0.07)]',
        className,
      )}
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-dashed border-[#E3E5E8] px-4 py-2.5 dark:border-border">
        <h2 id={id} className="text-[0.8125rem] font-medium text-[#303030] dark:text-heading">
          {title}
        </h2>
        {control}
      </div>
      <div className="min-w-0 px-4 pt-3 pb-4">{children}</div>
    </section>
  )
}

/** The drawn empty-state glyph: a sheet with lines and a warning triangle on its corner. */
function NoRecordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 4h15l7 7v12.5a9 9 0 0 0-9.4 12.5H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="currentColor"
      />
      <path d="M23 4v7h7" fill="currentColor" opacity="0.55" />
      <path d="M11 14h12M11 19h12M11 24h7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M29.2 24.5a1.4 1.4 0 0 1 2.4 0l6.6 11.4a1.4 1.4 0 0 1-1.2 2.1H23.8a1.4 1.4 0 0 1-1.2-2.1l6.6-11.4Z"
        fill="currentColor"
      />
      <path d="M30.4 29v4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="30.4" cy="35.4" r="1" fill="#FFFFFF" />
    </svg>
  )
}

/** "No Record Found!" with its glyph, as drawn; `note` says why there is nothing. */
function Empty({ note }: { note?: string }) {
  return (
    <div
      role="status"
      className="grid justify-items-center gap-1.5 py-3 text-center text-[0.6875rem] font-medium text-[#5C5C5C] dark:text-field-foreground"
    >
      <NoRecordIcon className="size-9 text-[#D8D8D8] dark:text-muted-foreground" />
      No Record Found!
      {note && <span className="font-normal text-muted-foreground">{note}</span>}
    </div>
  )
}

/** A failed read, in the card, with Retry. */
function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="grid justify-items-center gap-2 py-6 text-center">
      <p className="text-xs text-destructive">Could not load {what}.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        aria-label={`Retry loading ${what}`}
        className="h-7 px-3 text-xs"
      >
        Retry
      </Button>
    </div>
  )
}

/** Expense Report: the month's pay items as bars, longest first. */
function BreakupBars({ items }: { items: PayrollDashboard['salaryBreakup'] }) {
  const sorted = items.toSorted((a, b) => b.amount - a.amount)
  const max = Math.max(1, ...sorted.map((item) => Math.abs(item.amount)))
  return (
    <ul aria-label="Pay item totals" className="grid gap-2.5">
      {sorted.map((item) => (
        <li key={item.payItemId} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[0.6875rem]">
            <span className="min-w-0 truncate text-[#5C5C5C] dark:text-field-foreground">
              {item.payItemName}{' '}
              <span className="text-muted-foreground">({PAY_ITEM_TYPE_LABELS[item.itemType]})</span>
            </span>
            <span className="shrink-0 font-medium text-[#303030] tabular-nums dark:text-heading">
              {formatRs(item.amount)}
            </span>
          </div>
          <span aria-hidden="true" className="h-2 rounded bg-[#F1F3F5] dark:bg-muted">
            <span
              className="block h-full rounded"
              style={{
                width: `${String(Math.max(2, (Math.abs(item.amount) / max) * 100))}%`,
                background: item.itemType === 'deduction' ? '#EC9AAD' : AMBER,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Payroll → Dashboard, as drawn (frame 3335:19650): Payroll Comparison Yearly (net pay per
 * month, this year against last year, from `GET /payroll/dashboard?year`), then Expenses Month
 * Wise (the year's gross pay per month) beside Expense Report (one month's pay item totals,
 * `?month=`), then Month Wise Loan & Advance (the Loans module's instalments per month) beside
 * Employee Month Wise Earning (one person's payslips).
 */
export function PayrollDashboardPage() {
  const allowed = useCan('payroll.dashboard.view')
  const [now] = useState(() => new Date())
  const year = now.getFullYear()
  const thisMonth = format(now, 'yyyy-MM')
  const [reportMonth, setReportMonth] = useState('')
  const [chosenEmployee, setChosenEmployee] = useState<{ id: string; name: string } | null>(null)

  const current = usePayrollDashboard({ year })
  const previous = usePayrollDashboard({ year: year - 1 })
  // With no month chosen the report is this year's latest month: the same read as `current`.
  const report = usePayrollDashboard(
    reportMonth
      ? { year: Number(reportMonth.slice(0, 4)), month: monthStart(reportMonth) }
      : { year },
  )
  const loans = useLoanMonths(year)
  const latest = useLatestPayslip()
  const employee =
    chosenEmployee ??
    (latest.data ? { id: latest.data.employeeId, name: latest.data.employeeName } : null)
  const earnings = useEmployeeEarnings(employee?.id ?? null)

  if (!allowed) {
    return (
      <PageContainer>
        <h1 className="sr-only">Payroll Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          You do not have access to the payroll dashboard.
        </p>
      </PageContainer>
    )
  }

  const monthKey = (index: number) => `${String(year)}-${String(index + 1).padStart(2, '0')}`
  const statistic = (data: PayrollDashboard | undefined, key: string) =>
    data?.salaryStatistics.find((row) => row.month.startsWith(key))
  const thisYearNet = MONTH_LABELS.map((_, index) => {
    const key = monthKey(index)
    return key > thisMonth ? null : (statistic(current.data, key)?.netPayable ?? 0)
  })
  const lastYearNet = MONTH_LABELS.map(
    (_, index) =>
      statistic(previous.data, `${String(year - 1)}-${String(index + 1).padStart(2, '0')}`)
        ?.netPayable ?? 0,
  )
  const pastMonths = MONTH_LABELS.filter((_, index) => monthKey(index) <= thisMonth)
  const grossByMonth = pastMonths.map(
    (_, index) => statistic(current.data, monthKey(index))?.gross ?? 0,
  )
  const loanMonths = MONTH_LABELS.map((_, index) =>
    loans.data?.find((row) => row.month === monthKey(index)),
  )
  const slips = (earnings.data ?? [])
    .toSorted((a, b) => a.payslipMonth.localeCompare(b.payslipMonth))
    .slice(-12)
  const shownReportMonth = reportMonth || monthOf(report.data?.breakupMonth)

  return (
    <PageContainer>
      <h1 className="sr-only">Payroll Dashboard</h1>

      <Panel title="Payroll Comparison Yearly">
        {current.isPending || previous.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : current.isError ? (
          <Failed
            what="the payroll comparison"
            onRetry={() => {
              void current.refetch()
              void previous.refetch()
            }}
          />
        ) : (
          <AreaChart
            title={`Payroll comparison yearly: net pay per month, ${String(year)} and ${String(year - 1)}`}
            labels={MONTH_LABELS}
            format={formatRs}
            series={[
              { key: 'this', label: String(year), colour: AMBER, values: thisYearNet, area: true },
              {
                key: 'last',
                label: String(year - 1),
                colour: GREEN,
                values: lastYearNet,
                area: true,
              },
            ]}
          />
        )}
      </Panel>

      <div className="grid gap-4 rounded-lg bg-[#FAFAFC] p-2.5 @3xl/page:grid-cols-2 dark:bg-muted/30">
        <Panel title="Expenses Month Wise">
          {current.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : current.isError ? (
            <Failed what="the expenses" onRetry={() => void current.refetch()} />
          ) : grossByMonth.every((value) => value === 0) ? (
            <Empty />
          ) : (
            <ColumnChart
              title={`Expenses month wise ${String(year)}: gross pay per month`}
              labels={pastMonths}
              format={formatRs}
              series={[{ key: 'gross', label: 'Gross Pay', colour: AMBER, values: grossByMonth }]}
            />
          )}
        </Panel>

        <Panel
          title="Expense Report"
          control={
            <MonthPicker
              aria-label="Expense report month"
              value={shownReportMonth}
              onChange={setReportMonth}
              placeholder="Select month"
              max={thisMonth}
              className="h-7 w-40 rounded border-transparent bg-[#F6F7F9] px-2.5 text-[0.6875rem] text-[#A3A3A3] italic shadow-none dark:bg-muted"
            />
          }
        >
          {report.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : report.isError ? (
            <Failed what="the expense report" onRetry={() => void report.refetch()} />
          ) : report.data.salaryBreakup.length === 0 ? (
            <Empty
              {...(shownReportMonth
                ? { note: `Nothing paid in ${formatMonth(shownReportMonth)}` }
                : {})}
            />
          ) : (
            <BreakupBars items={report.data.salaryBreakup} />
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-4 rounded-lg bg-[#FAFAFC] p-2.5 @3xl/page:grid-cols-2 dark:bg-muted/30">
        <Panel title="Month Wise Loan & Advance">
          {loans.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : loans.isError ? (
            <Failed what="the loans and advances" onRetry={() => void loans.refetch()} />
          ) : loans.data.length === 0 ? (
            <Empty />
          ) : (
            <ColumnChart
              title={`Month wise loan and advance ${String(year)}: instalments due and repaid`}
              labels={MONTH_LABELS}
              format={formatRs}
              series={[
                {
                  key: 'due',
                  label: 'Due',
                  colour: AMBER,
                  values: loanMonths.map((row) => row?.due ?? 0),
                },
                {
                  key: 'paid',
                  label: 'Repaid',
                  colour: GREEN,
                  values: loanMonths.map((row) => row?.paid ?? 0),
                },
              ]}
            />
          )}
        </Panel>

        <Panel title="Employee Month Wise Earning">
          <div className="grid gap-2">
            <EmployeeSearchSelect
              aria-label="Employee"
              value={employee?.id ?? null}
              known={employee ? [{ value: employee.id, label: employee.name }] : undefined}
              filters={EARNING_PEOPLE}
              onChange={(id, row) => {
                setChosenEmployee(id ? { id, name: row?.name ?? employee?.name ?? '' } : null)
              }}
              placeholder="Select employee"
              className="h-8 rounded-sm border-[#E3E5E8] text-xs"
            />
            {latest.isPending && !chosenEmployee ? (
              <Skeleton className="h-56 w-full" />
            ) : !employee ? (
              <Empty note="Pick an employee to see their earnings" />
            ) : earnings.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : earnings.isError ? (
              <Failed what="the earnings" onRetry={() => void earnings.refetch()} />
            ) : slips.length === 0 ? (
              <Empty note={`${employee.name} has no payslips yet`} />
            ) : (
              <AreaChart
                title={`${employee.name}: earnings per month`}
                labels={slips.map((slip) => format(parseISO(slip.payslipMonth), 'MMM yyyy'))}
                format={formatRs}
                height={260}
                zeroBand={false}
                series={[
                  {
                    key: 'earning',
                    label: 'Earning',
                    colour: GREEN,
                    values: slips.map((slip) => slip.totalEarnings ?? slip.gross ?? 0),
                    area: true,
                  },
                ]}
              />
            )}
          </div>
        </Panel>
      </div>
    </PageContainer>
  )
}
