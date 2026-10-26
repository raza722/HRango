import { type ReactNode, useId, useState } from 'react'
import { format } from 'date-fns'
import { FileWarning } from 'lucide-react'

import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAY_ITEM_TYPE_LABELS } from '../../constants'
import { usePayrollDashboard } from '../../hooks/use-payroll'
import type { PayrollDashboard } from '../../types/payroll.types'
import { formatMonth, formatRs, monthOf, monthStart } from '../../utils/format'
import { MonthPicker } from '../shared/month-picker'
import { YearPicker } from '../shared/year-picker'
import { AreaChart, BarChart } from './charts'

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2024, index, 1), 'MMM'),
)

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

function Tiles({ tiles }: { tiles: PayrollDashboard['tiles'] }) {
  const items: [string, string][] = [
    ['Payrolls', `${tiles.closedPayrolls} / ${tiles.totalPayrolls} closed`],
    ['Payslips', String(tiles.totalPayslips)],
    ['Released', String(tiles.releasedPayslips)],
    ['Paid', String(tiles.paidPayslips)],
    ['On Hold', String(tiles.onHoldPayslips)],
    ['Unpaid', String(tiles.unpaidPayslips)],
    ['Net Payable', formatRs(tiles.netPayable)],
    ['Paid Amount', formatRs(tiles.paidAmount)],
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 @2xl/page:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-muted/60 px-4 py-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold text-heading tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Payroll → Dashboard (`GET /payroll/dashboard?year&month`): the tiles, Salary Statistics (a
 * year's gross, deductions and net pay per month) and Salary Breakup (pay item totals of one
 * month; the latest month with payslips when none is chosen).
 */
export function PayrollDashboardPage() {
  const allowed = useCan('payroll.dashboard.view')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  const dashboard = usePayrollDashboard({
    year: Number(year),
    ...(month ? { month: monthStart(month) } : {}),
  })
  const data = dashboard.data
  const thisMonth = format(new Date(), 'yyyy-MM')
  const byMonth = (pick: (row: PayrollDashboard['salaryStatistics'][number]) => number) =>
    MONTH_LABELS.map((_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, '0')}`
      const row = data?.salaryStatistics.find((item) => item.month.startsWith(key))
      return row ? pick(row) : key > thisMonth ? null : 0
    })
  const breakup = data?.salaryBreakup ?? []

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

  return (
    <PageContainer>
      <h1 className="sr-only">Payroll Dashboard</h1>
      <Panel title="Payroll Overview">
        {!data ? <Skeleton className="h-24 w-full" /> : <Tiles tiles={data.tiles} />}
      </Panel>

      <Panel
        title="Salary Statistics"
        control={
          <YearPicker
            aria-label="Salary statistics year"
            value={year}
            onChange={(next) => {
              setYear(next)
              setMonth('')
            }}
            max={new Date().getFullYear()}
            className="h-8 w-32 text-xs"
          />
        }
      >
        {!data ? (
          <Skeleton className="h-60 w-full" />
        ) : data.salaryStatistics.length === 0 ? (
          <Empty />
        ) : (
          <div className="[--series-deductions:#E0457B] [--series-gross:#3B6FF5] [--series-net:#2CBD4D]">
            <AreaChart
              title={`Salary statistics ${year}: gross, deductions and net pay per month`}
              labels={MONTH_LABELS}
              format={formatRs}
              series={[
                {
                  key: 'gross',
                  label: 'Gross',
                  colour: 'var(--series-gross)',
                  values: byMonth((row) => row.gross),
                  area: true,
                },
                {
                  key: 'deductions',
                  label: 'Deductions',
                  colour: 'var(--series-deductions)',
                  values: byMonth((row) => row.deductions),
                },
                {
                  key: 'net',
                  label: 'Net Pay',
                  colour: 'var(--series-net)',
                  values: byMonth((row) => row.netPayable),
                  area: true,
                },
              ]}
            />
          </div>
        )}
      </Panel>

      <Panel
        title={`Salary Breakup${data?.breakupMonth ? ` · ${formatMonth(data.breakupMonth)}` : ''}`}
        control={
          <MonthPicker
            aria-label="Salary breakup month"
            value={month || monthOf(data?.breakupMonth)}
            onChange={setMonth}
            max={thisMonth}
            className="h-8 w-44 text-xs"
          />
        }
      >
        {!data ? (
          <Skeleton className="h-40 w-full" />
        ) : breakup.length === 0 ? (
          <Empty />
        ) : (
          <BarChart
            title="Salary breakup by pay item"
            labels={breakup.map(
              (item) => `${item.payItemName} (${PAY_ITEM_TYPE_LABELS[item.itemType]})`,
            )}
            values={breakup.map((item) => item.amount)}
            colour="#3B6FF5"
            format={formatRs}
          />
        )}
      </Panel>
    </PageContainer>
  )
}
