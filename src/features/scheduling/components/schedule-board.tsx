import { Fragment } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { ShiftTone } from '../constants'
import type { BoardRow, ScheduleEntry } from '../types/scheduling.types'
import { toDate, weekBands } from '../utils/schedule-dates'
import { formatHours } from '../utils/shift-hours'
import { type CellAction, DayCell } from './day-cell'
import { schedulingType } from './type-styles'

export interface ScheduleBoardProps {
  rows: readonly BoardRow[]
  days: readonly string[]
  today: string
  rangeLabel: string
  onPrevious: () => void
  onNext: () => void
  dayTotals: Record<string, number>
  isLoading: boolean
  isFetching: boolean
  multiselect: boolean
  selectedIds: ReadonlySet<string>
  canCreate: boolean
  toneFor: (rosterGroupId: string | null) => ShiftTone
  onToggleSelect: (entry: ScheduleEntry) => void
  onAction: (action: CellAction, entry: ScheduleEntry) => void
  onMove: (entryId: string, employeeId: string, date: string) => void
  onNudge: (entry: ScheduleEntry, days: -1 | 1) => void
  onCreateAt: (employeeId: string, date: string, kind: 'shift' | 'rest') => void
}

/** Purple block left of the days: the period (Inter Medium 20 white) and its arrows. */
export function PeriodNav({
  label,
  onPrevious,
  onNext,
}: {
  label: string
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex h-full items-center justify-between gap-1 px-2 sm:px-3">
      <button
        type="button"
        aria-label="Previous period"
        onClick={onPrevious}
        className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span
        aria-live="polite"
        className="text-center text-sm leading-tight font-medium sm:text-base @md/board:text-xl"
      >
        {label}
      </span>
      <button
        type="button"
        aria-label="Next period"
        onClick={onNext}
        className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

/** Name, id, usual slot, planned hours and status of one person (left column). */
function EmployeeCell({ row }: { row: BoardRow }) {
  const { employee } = row
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 sm:px-3">
      <EmployeeAvatar name={employee.name} className="hidden size-9 @sm/board:flex" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#101828] dark:text-heading">
          {employee.name}
        </p>
        <p className="truncate text-xs text-[#475467] dark:text-muted-foreground">
          {employee.code}
        </p>
        <span
          className={cn(
            'mt-1 inline-block rounded-sm px-1.5 py-0.5 text-xs leading-none',
            row.onShiftToday
              ? 'bg-green-400 text-green-950'
              : cn('bg-chip dark:bg-input', schedulingType.grey),
          )}
        >
          {employee.defaultSlot}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span
          className={cn(
            'text-sm font-medium tabular-nums @md/board:text-base',
            schedulingType.grey,
          )}
          title="Planned hours in this period"
        >
          {formatHours(row.plannedMinutes)}
        </span>
        <span
          className={cn('flex items-center gap-1 text-xs @md/board:text-sm', schedulingType.grey)}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              employee.status === 'active' ? 'bg-green-500' : 'bg-label',
            )}
          />
          {employee.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )
}

const stickyFirst =
  'sticky left-0 z-30 w-[11.5rem] min-w-[11.5rem] border-r @md/board:w-[15rem] @md/board:min-w-[15rem]'

/**
 * The Scheduling grid as drawn: the purple period block, a column per day
 * (today shaded), yellow week bands, a row per employee and Planned Hours at
 * the bottom. Days scroll sideways under the sticky employee column.
 */
export function ScheduleBoard({
  rows,
  days,
  today,
  rangeLabel,
  onPrevious,
  onNext,
  dayTotals,
  isLoading,
  isFetching,
  multiselect,
  selectedIds,
  canCreate,
  toneFor,
  onToggleSelect,
  onAction,
  onMove,
  onNudge,
  onCreateAt,
}: ScheduleBoardProps) {
  const bands = weekBands(days)

  return (
    <div className="@container/board min-w-0">
      <div className="scrollbar-brand overflow-x-auto overscroll-x-contain rounded-md border">
        <table
          aria-busy={isLoading || isFetching}
          className={cn(
            'w-max min-w-full border-separate border-spacing-0 text-sm transition-opacity',
            isFetching && !isLoading && 'opacity-70',
          )}
        >
          <caption className="sr-only">Shift schedule, {rangeLabel}</caption>
          <thead>
            <tr>
              <th
                rowSpan={2}
                scope="col"
                className={cn(stickyFirst, 'z-40 bg-primary p-0 text-primary-foreground')}
              >
                <PeriodNav label={rangeLabel} onPrevious={onPrevious} onNext={onNext} />
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  aria-current={day === today ? 'date' : undefined}
                  className={cn(
                    'h-12 w-24 min-w-24 border-b border-l px-1 text-center font-medium',
                    schedulingType.grey,
                    day === today ? 'bg-violet-100 dark:bg-violet-500/15' : 'bg-muted',
                  )}
                >
                  <span className="block text-xs sm:text-base">{format(toDate(day), 'EEE')}</span>
                  <span className="block text-sm sm:text-base">{format(toDate(day), 'd')}</span>
                </th>
              ))}
            </tr>
            <tr>
              {bands.map((band) => (
                <th
                  key={band.key}
                  scope="colgroup"
                  colSpan={band.span}
                  className={cn(
                    // Figma: Inter Medium 16 #585858; kept at 12px so a one-day band fits its 6rem column.
                    'h-7 border-b border-l bg-yellow-100 px-2 text-center text-xs font-medium whitespace-nowrap dark:bg-yellow-400/15',
                    schedulingType.grey,
                  )}
                >
                  {band.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? Array.from({ length: 4 }, (_, index) => (
                  <tr key={index}>
                    <th scope="row" className={cn(stickyFirst, 'bg-card p-3')}>
                      <Skeleton className="h-10 w-full" />
                    </th>
                    {days.map((day) => (
                      <td key={day} className="border-b border-l p-1">
                        <Skeleton className="h-[4.25rem] w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const byDate = new Map(row.entries.map((entry) => [entry.date, entry]))
                  return (
                    <tr key={row.employee.id} className="[&>td]:border-b [&>td]:border-l">
                      <th
                        scope="row"
                        className={cn(stickyFirst, 'border-b bg-card text-left font-normal')}
                      >
                        <EmployeeCell row={row} />
                      </th>
                      {days.map((day) => {
                        const entry = byDate.get(day)
                        return (
                          <Fragment key={day}>
                            <DayCell
                              entry={entry}
                              employeeName={row.employee.name}
                              date={day}
                              tone={toneFor(entry?.rosterGroupId ?? null)}
                              isToday={day === today}
                              multiselect={multiselect}
                              selected={entry !== undefined && selectedIds.has(entry.id)}
                              canCreate={canCreate}
                              onToggleSelect={onToggleSelect}
                              onAction={onAction}
                              onDropEntry={(entryId) => {
                                onMove(entryId, row.employee.id, day)
                              }}
                              onNudge={onNudge}
                              onCreate={(kind) => {
                                onCreateAt(row.employee.id, day, kind)
                              }}
                            />
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="h-32 text-center text-muted-foreground">
                  No employees match these filters.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr>
              <th
                scope="row"
                className={cn(
                  stickyFirst,
                  'h-12 bg-card text-center text-base font-medium text-title @md/board:text-xl',
                )}
              >
                Planned Hours
              </th>
              {days.map((day) => (
                <td
                  key={day}
                  className={cn(
                    'border-l text-center text-sm font-medium tabular-nums sm:text-base',
                    schedulingType.grey,
                    day === today && 'bg-violet-100/70 dark:bg-violet-500/10',
                  )}
                >
                  {formatHours(dayTotals[day] ?? 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
