import { format, parse } from 'date-fns'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { DAY_STATUS_META } from '../../constants'
import type { DayStatus, OverviewRow } from '../../types/attendance.types'
import { StatusIcon } from '../shared/status-badges'

interface OverviewTableProps {
  rows: readonly OverviewRow[]
  days: readonly string[]
  today: string
  isLoading: boolean
  isFetching: boolean
  highlight: DayStatus | null
  onOpenDay: (employeeId: string, date: string) => void
}

const head =
  'h-[4.5rem] border-r border-white/25 px-3 text-center text-sm font-medium whitespace-nowrap last:border-r-0 sm:text-base'
const cell = 'border-r border-b border-[#EDEAEA] px-3 py-3 text-center dark:border-border'
const stickyId = 'sticky left-0 z-20 w-16 min-w-16 sm:w-20 sm:min-w-20'
const stickyName =
  'sticky left-16 z-20 w-36 min-w-36 sm:left-20 sm:w-44 sm:min-w-44 shadow-[2px_0_0_0_var(--color-border)]'

/**
 * The monthly grid of Attendance Overview: Emp Id, Employee Name,
 * Department, Designation, the totals, then one column per day with the
 * day's state (icon and label). Days scroll sideways under the first two
 * columns; a day opens its time sheet.
 */
export function OverviewTable({
  rows,
  days,
  today,
  isLoading,
  isFetching,
  highlight,
  onOpenDay,
}: OverviewTableProps) {
  const month = days[0] ? format(parse(days[0], 'yyyy-MM-dd', new Date()), 'MMMM yyyy') : ''
  return (
    <div className="scrollbar-brand overflow-x-auto overscroll-x-contain">
      <table
        aria-busy={isLoading || isFetching}
        className={cn(
          'w-max min-w-full border-separate border-spacing-0 font-inter text-sm font-medium transition-opacity sm:text-base',
          isFetching && !isLoading && 'opacity-70',
        )}
      >
        <caption className="sr-only">Attendance by day, {month}</caption>
        <thead>
          <tr className="bg-primary text-primary-foreground [&>th]:bg-primary">
            <th scope="col" className={cn(head, stickyId)}>
              Emp Id
            </th>
            <th scope="col" className={cn(head, stickyName)}>
              Employee Name
            </th>
            <th scope="col" className={head}>
              Department
            </th>
            <th scope="col" className={head}>
              Designation
            </th>
            <th scope="col" className={cn(head, 'leading-tight')}>
              Total
              <br />
              Days
            </th>
            <th scope="col" className={head}>
              Absent
            </th>
            <th scope="col" className={head}>
              Holiday
            </th>
            <th scope="col" className={head}>
              Present
            </th>
            {days.map((day) => {
              const date = parse(day, 'yyyy-MM-dd', new Date())
              return (
                <th
                  key={day}
                  scope="col"
                  aria-current={day === today ? 'date' : undefined}
                  className={cn(
                    head,
                    'w-[4.5rem] min-w-[4.5rem] px-1',
                    day === today && 'bg-violet-700!',
                  )}
                >
                  <span className="block">{format(date, 'd')}</span>
                  <span className="block text-[0.6875rem] font-normal opacity-80">
                    {format(date, 'EEE')}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={8 + days.length} className="border-b p-3">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              ))
            : rows.map((row, index) => {
                const zebra = index % 2 === 0 ? 'bg-[#F5F5F5] dark:bg-muted/40' : 'bg-card'
                return (
                  <tr key={row.employeeId} className={cn('text-title', zebra)}>
                    <td className={cn(cell, stickyId, zebra)}>{row.employeeCode}</td>
                    <th
                      scope="row"
                      className={cn(
                        cell,
                        stickyName,
                        zebra,
                        'text-left text-sm font-medium text-[#101828] dark:text-heading',
                      )}
                    >
                      <span className="line-clamp-2">{row.employeeName}</span>
                    </th>
                    <td className={cn(cell, 'max-w-40 min-w-32')}>{row.departmentName ?? '—'}</td>
                    <td className={cn(cell, 'max-w-40 min-w-32')}>{row.designationName ?? '—'}</td>
                    <td className={cn(cell, 'tabular-nums')}>{row.totals.totalDays}</td>
                    <td className={cn(cell, 'tabular-nums')}>{row.totals.absent}</td>
                    <td className={cn(cell, 'tabular-nums')}>{row.totals.holiday}</td>
                    <td className={cn(cell, 'tabular-nums')}>{row.totals.present}</td>
                    {days.map((day) => {
                      const status: DayStatus | null = row.days[day] ?? null
                      const dimmed = highlight !== null && status !== highlight
                      return (
                        <td
                          key={day}
                          className={cn(
                            cell,
                            'p-0.5',
                            day === today && 'bg-violet-100/70 dark:bg-violet-500/10',
                          )}
                        >
                          {status ? (
                            <button
                              type="button"
                              aria-label={`${row.employeeName}, ${format(parse(day, 'yyyy-MM-dd', new Date()), 'd MMMM')}: ${DAY_STATUS_META[status].label}`}
                              onClick={() => {
                                onOpenDay(row.employeeId, day)
                              }}
                              className={cn(
                                'flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-sm px-0.5 py-1 text-[0.6875rem] leading-tight font-normal transition-opacity outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-ring/60 dark:hover:bg-white/5',
                                dimmed && 'opacity-25',
                                highlight === status && 'bg-primary/10',
                              )}
                            >
                              <StatusIcon status={status} />
                              <span className="line-clamp-2 text-center">
                                {DAY_STATUS_META[status].label}
                              </span>
                            </button>
                          ) : (
                            <span aria-label="Not processed" className="text-label">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td
                colSpan={8 + days.length}
                className="h-32 text-center text-sm font-normal text-muted-foreground"
              >
                No employees match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
