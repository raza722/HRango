import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { ACTION_META, DAY_FLAG_LABELS, PENALTY_TYPE_LABELS } from '../../constants'
import type {
  DayStatus,
  TimeSheetAction,
  TimeSheetDay,
  TimeSheetScope,
} from '../../types/attendance.types'
import {
  formatClockTime,
  formatDuration,
  formatExpected,
  formatSheetDate,
  minutesBetween,
  weekdayName,
} from '../../utils/local-time'
import { rowActions } from '../../utils/row-actions'
import { PunchChip, StatusPill } from '../shared/status-badges'

const EMPTY = '-- -- --'

/** Day states the clock chips already say; any other day with chips shows its state under the date. */
const CHIP_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>(['present', 'absent'])

/** Flags the chips already show. */
const CHIP_FLAGS: ReadonlySet<string> = new Set([
  'late',
  'early',
  'grace',
  'overtime',
  'missing_punch',
])

interface TimeSheetTableProps {
  rows: readonly TimeSheetDay[]
  scope: TimeSheetScope
  today: string
  isLoading: boolean
  isFetching: boolean
  /** May the user edit days (attendance.time_sheet.edit)? */
  canEdit: boolean
  onAction: (action: TimeSheetAction, day: TimeSheetDay) => void
}

const COLUMNS = [
  'Date',
  'Employee',
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

/** Check in to check out. */
const duration = (day: TimeSheetDay) =>
  day.firstIn && day.lastOut ? Math.max(0, minutesBetween(day.firstIn, day.lastOut)) : null

/** Overtime worked (before the start and after the end). */
const overtime = (day: TimeSheetDay) =>
  (day.overtimeBeforeMinutes ?? 0) + (day.overtimeAfterMinutes ?? 0)

/** Warnings raised on the day by the Warning policies, with the heaviest penalty. */
function WarningCell({ day }: { day: TimeSheetDay }) {
  if (day.warningCount === 0) return null
  const penalty =
    day.penaltyType === 'percentage' && day.penaltyPercentage !== null
      ? `${day.penaltyPercentage}% Penalty`
      : day.penaltyType
        ? `${PENALTY_TYPE_LABELS[day.penaltyType] ?? day.penaltyType} Penalty`
        : null
  return (
    <div className="mx-auto grid w-28 gap-1">
      <span className="font-sans text-xs font-medium text-[#FF5329] uppercase">
        {day.warningCount} warning{day.warningCount === 1 ? '' : 's'}
      </span>
      {penalty && (
        <span className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-[#E4393C]">
          <span aria-hidden="true" className="size-3 rounded-full bg-[#E50141]" />
          {penalty}
        </span>
      )}
    </div>
  )
}

function ActionButton({
  action,
  day,
  withName,
  onAction,
}: {
  action: TimeSheetAction
  day: TimeSheetDay
  /** Subordinates and All list many people: the label names whose day it is. */
  withName: boolean
  onAction: TimeSheetTableProps['onAction']
}) {
  const meta = ACTION_META[action]
  const label = withName
    ? `${meta.label}, ${day.employeeName}, ${formatSheetDate(day.workDate)}`
    : `${meta.label}, ${formatSheetDate(day.workDate)}`
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
 * The time sheet as drawn: one row per person and day with the expected and
 * actual clock in / out, their status chips, the minutes and hours, the
 * warnings and the row actions. Wide columns scroll under the sticky date.
 * "My" has no Employee column.
 */
export function TimeSheetTable({
  rows,
  scope,
  today,
  isLoading,
  isFetching,
  canEdit,
  onAction,
}: TimeSheetTableProps) {
  const columns = scope === 'my' ? COLUMNS.filter((column) => column !== 'Employee') : COLUMNS
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
            {columns.map((column) => (
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
                  <td colSpan={columns.length} className="border-b p-3">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              ))
            : rows.map((day, index) => {
                // Opaque in both themes: the sticky Emp Id / Name cells hide what scrolls under them.
                const zebra =
                  index % 2 === 0
                    ? 'bg-[#F5F5F5] dark:bg-[color-mix(in_srgb,var(--color-muted)_40%,var(--color-card))]'
                    : 'bg-card'
                const actions = rowActions(day, scope, today, canEdit)
                const extra = day.flags.filter((flag) => !CHIP_FLAGS.has(flag))
                const worked = overtime(day)
                return (
                  <tr key={day.id} className={zebra}>
                    <th
                      scope="row"
                      className={cn(
                        cell,
                        stickyDate,
                        zebra,
                        'text-left text-sm font-medium whitespace-nowrap',
                      )}
                    >
                      {formatSheetDate(day.workDate)}
                      {day.clockInStatus && !CHIP_STATUSES.has(day.dayStatus) && (
                        <StatusPill status={day.dayStatus} className="mt-1 flex w-fit" />
                      )}
                      {extra.length > 0 && (
                        <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                          {extra.map((flag) => DAY_FLAG_LABELS[flag]).join(', ')}
                        </span>
                      )}
                      {day.isManuallyUpdated && (
                        <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                          Manually updated
                        </span>
                      )}
                    </th>
                    {scope !== 'my' && (
                      <td className={cn(cell, 'min-w-40 text-left text-sm')}>
                        <span className="block font-medium">{day.employeeName}</span>
                        <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                          {day.employeeCode}
                        </span>
                      </td>
                    )}
                    <td className={cn(cell, 'max-w-28')}>{day.timeSlotName ?? '—'}</td>
                    <td className={cn(cell, 'text-sm whitespace-nowrap')}>
                      {weekdayName(day.workDate)}
                    </td>
                    <td className={cn(cell, 'min-w-28 whitespace-nowrap')}>
                      {day.firstIn && (
                        <span className="block font-medium">{formatClockTime(day.firstIn)}</span>
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
                      ) : (
                        <StatusPill status={day.dayStatus} />
                      )}
                    </td>
                    <td className={cn(cell, 'min-w-28 whitespace-nowrap')}>
                      {day.lastOut && (
                        <span className="block font-medium">{formatClockTime(day.lastOut)}</span>
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
                      {day.firstIn ? (day.lateMinutes ?? 0) : EMPTY}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(duration(day))}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.expectedMinutes)}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {hours(day.workedMinutes)}
                    </td>
                    <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                      {day.approvedOvertimeMinutes ? (
                        formatDuration(day.approvedOvertimeMinutes)
                      ) : worked > 0 ? (
                        <span title="Overtime worked, not approved yet" className="text-primary">
                          {formatDuration(worked)} pending
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
                      <WarningCell day={day} />
                    </td>
                    <td className={cn(cell, 'border-r-0')}>
                      <div className="flex items-center justify-center gap-1.5">
                        {actions.map((action) => (
                          <ActionButton
                            key={action}
                            action={action}
                            day={day}
                            withName={scope !== 'my'}
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
                colSpan={columns.length}
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
