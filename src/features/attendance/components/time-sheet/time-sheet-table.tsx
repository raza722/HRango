import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { ACTION_META } from '../../constants'
import type {
  DayStatus,
  TimeSheetAction,
  TimeSheetDay,
  TimeSheetScope,
  WarningMark,
} from '../../types/attendance.types'
import {
  formatClockTime,
  formatDuration,
  formatExpected,
  formatSheetDate,
  weekdayName,
} from '../../utils/local-time'
import { rowActions } from '../../utils/row-actions'
import { PunchChip, StatusPill } from '../shared/status-badges'

const EMPTY = '-- -- --'

/** Day states the clock chips already say; any other worked day shows its state under the date. */
const CHIP_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'present',
  'late-arrival',
  'early-left',
  'absent',
])

interface TimeSheetTableProps {
  rows: readonly TimeSheetDay[]
  scope: TimeSheetScope
  today: string
  isLoading: boolean
  isFetching: boolean
  onAction: (action: TimeSheetAction, day: TimeSheetDay) => void
}

const COLUMNS = [
  'Date',
  'Time Slot / Roster',
  'Day',
  'Clock In',
  'Clock In Status',
  'Clock Out',
  'Clock Out Status',
  'Late Mins',
  'Duration',
  'Expected Hours',
  'Worked Hours',
  'Approved Overtime',
  'Break Hours',
  'Shift Worked Hours',
  'Warnings',
  'Actions',
] as const

const cell = 'border-r border-b border-[#EDEAEA] px-3 py-3 text-center dark:border-border'
const stickyDate = 'sticky left-0 z-20 shadow-[2px_0_0_0_var(--color-border)]'

const hours = (minutes: number | null) => (minutes === null ? EMPTY : formatDuration(minutes))

/** Orange progress of the monthly warning rule, with the penalty when reached. */
function WarningCell({ warning }: { warning: WarningMark | null }) {
  if (!warning) return null
  return (
    <div className="mx-auto grid w-24 gap-1">
      <span className="font-sans text-xs font-medium text-[#FF5329] uppercase">
        {warning.percent}%
      </span>
      <span
        role="meter"
        aria-label="Warnings this month"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={warning.percent}
        className="h-1 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-500/20"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-b from-[#FF4B1E] to-[#F4650D]"
          style={{ width: `${warning.percent}%` }}
        />
      </span>
      {warning.penalty && (
        <span className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-[#E4393C]">
          <span aria-hidden="true" className="size-3 rounded-full bg-[#E50141]" />
          {warning.penalty}
        </span>
      )}
    </div>
  )
}

function ActionButton({
  action,
  day,
  onAction,
}: {
  action: TimeSheetAction
  day: TimeSheetDay
  onAction: TimeSheetTableProps['onAction']
}) {
  const meta = ACTION_META[action]
  const label = `${meta.label}, ${formatSheetDate(day.date)}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            onAction(action, day)
          }}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
            meta.backdrop,
          )}
        >
          <img
            src={meta.icon}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={meta.backdrop ? 'h-5 w-5 object-contain' : 'size-8 object-contain'}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{meta.label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The time sheet as drawn: one row per day with the expected and actual
 * clock in / out, their status chips, the minutes and hours, the warning
 * progress and the row actions. Wide columns scroll under the sticky date.
 */
export function TimeSheetTable({
  rows,
  scope,
  today,
  isLoading,
  isFetching,
  onAction,
}: TimeSheetTableProps) {
  return (
    <div className="scrollbar-brand overflow-x-auto overscroll-x-contain">
      <table
        aria-busy={isLoading || isFetching}
        className={cn(
          'w-max min-w-full border-separate border-spacing-0 font-inter text-sm font-medium transition-opacity sm:text-base',
          isFetching && !isLoading && 'opacity-70',
        )}
      >
        <caption className="sr-only">Time sheet</caption>
        <thead>
          <tr className="[&>th]:bg-primary [&>th]:text-primary-foreground">
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  'h-[5.25rem] border-r border-white/25 px-3 text-center text-sm font-medium last:border-r-0 sm:text-base',
                  column === 'Date' && stickyDate,
                  column === 'Time Slot / Roster' ? 'w-24 text-xs leading-tight sm:text-sm' : '',
                  column === 'Actions' ? 'min-w-44' : 'max-w-28',
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[#303030] dark:text-field-foreground">
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={COLUMNS.length} className="border-b p-3">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              ))
            : rows.map((day, index) => {
                const zebra = index % 2 === 0 ? 'bg-[#F5F5F5] dark:bg-muted/40' : 'bg-card'
                const actions = rowActions(day, scope, today)
                return (
                  <tr key={day.date} className={zebra}>
                    <th
                      scope="row"
                      className={cn(
                        cell,
                        stickyDate,
                        zebra,
                        'text-left text-sm font-medium whitespace-nowrap',
                      )}
                    >
                      {formatSheetDate(day.date)}
                      {day.clockInStatus && day.status && !CHIP_STATUSES.has(day.status) && (
                        <StatusPill status={day.status} className="mt-1 flex w-fit" />
                      )}
                      {day.manuallyUpdated && (
                        <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                          Manually updated
                        </span>
                      )}
                    </th>
                    <td className={cn(cell, 'max-w-28')}>{day.slotName ?? '—'}</td>
                    <td className={cn(cell, 'text-sm whitespace-nowrap')}>
                      {weekdayName(day.date)}
                    </td>
                    <td className={cn(cell, 'min-w-28 whitespace-nowrap')}>
                      {day.checkIn && (
                        <span className="block font-medium">{formatClockTime(day.checkIn)}</span>
                      )}
                      {day.expectedIn && (
                        <span className="block text-[0.6875rem] font-light italic">
                          {formatExpected(day.expectedIn)}
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      {day.clockInStatus ? (
                        <PunchChip status={day.clockInStatus} />
                      ) : day.status ? (
                        <StatusPill status={day.status} />
                      ) : null}
                    </td>
                    <td className={cn(cell, 'min-w-28 whitespace-nowrap')}>
                      {day.checkOut && (
                        <span className="block font-medium">{formatClockTime(day.checkOut)}</span>
                      )}
                      {day.expectedOut && (
                        <span className="block text-[0.6875rem] font-light italic">
                          {formatExpected(day.expectedOut)}
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      {day.clockOutStatus && <PunchChip status={day.clockOutStatus} />}
                    </td>
                    <td className={cn(cell, 'tabular-nums')}>
                      {day.checkIn ? day.lateMinutes : EMPTY}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.durationMinutes)}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.expectedMinutes)}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.workedMinutes)}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {day.approvedOvertimeMinutes !== null ? (
                        formatDuration(day.approvedOvertimeMinutes)
                      ) : day.overtimeMinutes > 0 ? (
                        <span title="Overtime worked, not approved yet" className="text-primary">
                          {formatDuration(day.overtimeMinutes)} pending
                        </span>
                      ) : (
                        EMPTY
                      )}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {day.breakMinutes ? formatDuration(day.breakMinutes) : EMPTY}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.shiftWorkedMinutes)}
                    </td>
                    <td className={cn(cell, 'min-w-32')}>
                      <WarningCell warning={day.warning} />
                    </td>
                    <td className={cn(cell, 'border-r-0')}>
                      <div className="flex items-center justify-center gap-1.5">
                        {actions.map((action) => (
                          <ActionButton
                            key={action}
                            action={action}
                            day={day}
                            onAction={onAction}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="h-32 text-center text-sm font-normal text-muted-foreground"
              >
                No days match. Try another date range or search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
