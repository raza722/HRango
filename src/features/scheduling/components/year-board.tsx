import { format } from 'date-fns'

import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { YearRow } from '../types/scheduling.types'
import { toDate } from '../utils/schedule-dates'
import { formatHours } from '../utils/shift-hours'
import { PeriodNav } from './schedule-board'
import { schedulingType } from './type-styles'

interface YearBoardProps {
  rows: readonly YearRow[]
  year: number
  currentMonth: number | null
  rangeLabel: string
  onPrevious: () => void
  onNext: () => void
  isLoading: boolean
  /** Opens the month view on the first of that month (`yyyy-MM-dd`). */
  onOpenMonth: (day: string) => void
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index)

/**
 * Year view (`GET /scheduling/schedules/year`): planned hours, shifts and rest days per
 * month; a month opens its day view.
 */
export function YearBoard({
  rows,
  year,
  currentMonth,
  rangeLabel,
  onPrevious,
  onNext,
  isLoading,
  onOpenMonth,
}: YearBoardProps) {
  const monthDay = (month: number) => `${year}-${String(month + 1).padStart(2, '0')}-01`

  return (
    <div className="scrollbar-brand overflow-x-auto rounded-md border">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Planned hours per month, {rangeLabel}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 w-[11.5rem] min-w-[11.5rem] bg-primary p-0 text-primary-foreground sm:w-[15rem] sm:min-w-[15rem]"
            >
              <PeriodNav label={rangeLabel} onPrevious={onPrevious} onNext={onNext} />
            </th>
            {MONTHS.map((month) => (
              <th
                key={month}
                scope="col"
                className={cn(
                  // As the day headers: Inter Medium 16 #585858.
                  'h-12 w-24 min-w-24 border-b border-l px-1 text-center font-medium sm:text-base',
                  schedulingType.grey,
                  month === currentMonth ? 'bg-violet-100 dark:bg-violet-500/15' : 'bg-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenMonth(monthDay(month))
                  }}
                  className="rounded-sm px-2 py-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {format(toDate(monthDay(month)), 'MMM')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <tr key={index}>
                  <th scope="row" className="sticky left-0 bg-card p-3">
                    <Skeleton className="h-9 w-full" />
                  </th>
                  {MONTHS.map((month) => (
                    <td key={month} className="border-b border-l p-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const byMonth = new Map(row.months.map((item) => [item.month, item]))
                const totals = MONTHS.map((month) => {
                  const item = byMonth.get(month + 1)
                  return {
                    minutes: item?.plannedMinutes ?? 0,
                    shifts: item?.shiftCount ?? 0,
                    restDays: item?.restDays ?? 0,
                  }
                })
                return (
                  <tr key={row.employee.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b bg-card px-3 py-2 text-left font-normal"
                    >
                      <span className="flex items-center gap-2.5">
                        <EmployeeAvatar name={row.employee.name} className="hidden sm:flex" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#101828] dark:text-heading">
                            {row.employee.name}
                          </span>
                          <span className="block text-xs text-[#475467] tabular-nums dark:text-muted-foreground">
                            {formatHours(row.employee.plannedMinutes)} planned
                          </span>
                        </span>
                      </span>
                    </th>
                    {totals.map((total, month) => (
                      <td
                        key={month}
                        className={cn(
                          'border-b border-l px-2 py-2 text-center tabular-nums',
                          month === currentMonth && 'bg-violet-100/70 dark:bg-violet-500/10',
                        )}
                      >
                        <span className="block text-sm text-heading">
                          {formatHours(total.minutes)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {total.shifts} shift{total.shifts === 1 ? '' : 's'}
                        </span>
                        {total.restDays > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {total.restDays} rest day{total.restDays === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
