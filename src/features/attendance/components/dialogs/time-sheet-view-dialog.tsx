import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'

import { DAY_FLAG_LABELS } from '../../constants'
import { useAttendanceDay } from '../../hooks/use-attendance'
import type { AttendanceBreak, DayKey } from '../../types/attendance.types'
import { profileOfDay } from '../../utils/day'
import {
  formatClockTime,
  formatDuration,
  formatExpected,
  formatLongDate,
  formatPunchTime,
} from '../../utils/local-time'
import { interDialogClass } from '../../utils/settings-styles'
import { ManualBadge, ReadOnlyField } from '../shared/attendance-dialog'
import { PersonCard } from '../shared/person-card'
import { PunchChip, StatusPill } from '../shared/status-badges'
import { AttendanceLogDialog } from './attendance-log-dialog'
import { HistoryDialog } from './history-dialog'

const expected = (time: string | null) =>
  time ? formatExpected(time).replace('Expected ', '') : '—'

function BreakItem({ item }: { item: AttendanceBreak }) {
  return (
    <details open className="group border-b py-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-base font-medium text-[#202020] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-lg dark:text-heading [&::-webkit-details-marker]:hidden">
        {item.breakTypeName ?? 'Break'}
        <ChevronDown
          aria-hidden="true"
          className="size-5 text-field-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <dl className="mt-3 grid gap-3 text-sm @2xl:grid-cols-[12rem_12rem_minmax(0,1fr)]">
        <div>
          <dt className="font-medium text-title">Mark Break Out</dt>
          <dd className="mt-1 text-field-value">{formatPunchTime(item.outAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-title">Mark Break In</dt>
          <dd className="mt-1 text-field-value">
            {item.inAt ? formatPunchTime(item.inAt) : 'Still on break'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-medium text-title">Duration</dt>
          <dd className="mt-1 text-field-value">
            {item.minutes !== null ? formatDuration(item.minutes) : '—'}
          </dd>
        </div>
      </dl>
    </details>
  )
}

/**
 * Time Sheet View: the person, the day's state and flags, expected and actual
 * times, the breaks and the comments, with History and Logs (and Edit on All).
 */
export function TimeSheetViewDialog({
  dayKey,
  onClose,
  onEdit,
}: {
  dayKey: DayKey
  onClose: () => void
  onEdit?: (() => void) | undefined
}) {
  const detail = useAttendanceDay(dayKey)
  const [sub, setSub] = useState<'history' | 'logs' | null>(null)
  const data = detail.data
  const day = data?.day
  const profile = day ? profileOfDay(day) : undefined
  const flags = data?.flags ?? []

  return (
    <>
      <AppDialog
        title={`Time sheet of ${day?.employeeName ?? 'employee'}, ${formatLongDate(dayKey.date)}`}
        hideTitle
        className={interDialogClass}
        onRequestClose={onClose}
        footer={
          <>
            <div className="mr-auto flex flex-wrap gap-3 sm:gap-4">
              <Button
                size="lg"
                onClick={() => {
                  setSub('history')
                }}
                className={`${dialogButtonClass} bg-[#F08A24] text-white hover:bg-[#F08A24]/90`}
              >
                History
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setSub('logs')
                }}
                className={`${dialogButtonClass} bg-[#3B6FF5] text-white hover:bg-[#3B6FF5]/90`}
              >
                Logs
              </Button>
            </div>
            {onEdit && (
              <Button variant="success" size="lg" onClick={onEdit} className={dialogButtonClass}>
                Edit
              </Button>
            )}
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        }
      >
        {detail.isError ? (
          <ErrorState
            title="Could not load this day"
            message="Check your connection and try again."
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <div className="grid gap-6">
            <PersonCard profile={profile} />

            {day && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-field-foreground">
                  <StatusPill status={day.dayStatus} className="text-sm" />
                  {day.clockInStatus && (
                    <span className="flex items-center gap-1.5">
                      In <PunchChip status={day.clockInStatus} />
                    </span>
                  )}
                  {day.clockOutStatus && (
                    <span className="flex items-center gap-1.5">
                      Out <PunchChip status={day.clockOutStatus} />
                    </span>
                  )}
                  {day.timeSlotName && (
                    <span className="text-muted-foreground">· {day.timeSlotName}</span>
                  )}
                </div>
                {flags.length > 0 && (
                  <ul aria-label="Flags" className="flex flex-wrap gap-2 text-xs">
                    {flags.map((item) => (
                      <li key={item.flag} className="rounded-sm bg-muted px-2 py-1 text-title">
                        {DAY_FLAG_LABELS[item.flag]}
                        {item.minutes ? ` · ${formatDuration(item.minutes)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2 @3xl:grid-cols-3">
                  <ReadOnlyField
                    tone="view"
                    label="Day"
                    value={formatLongDate(day.workDate)}
                    icon={<CalendarDays className="size-4 shrink-0" aria-hidden="true" />}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Expected Check-in"
                    value={expected(day.expectedIn)}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Check In Time"
                    value={day.firstIn ? formatClockTime(day.firstIn) : '—'}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Expected Check out"
                    value={expected(day.expectedOut)}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Check Out Time"
                    value={day.lastOut ? formatClockTime(day.lastOut) : '—'}
                  />
                  <div className="flex items-end">
                    <ManualBadge updated={day.isManuallyUpdated} />
                  </div>
                </div>
              </>
            )}

            <section aria-labelledby="view-breaks" className="grid">
              <h3 id="view-breaks" className="text-xl font-medium text-heading sm:text-2xl">
                Breaks
              </h3>
              {data?.breaks.length === 0 ? (
                <p className="mt-2 rounded-md bg-success/15 px-3 py-2.5 text-sm text-field-foreground">
                  No breaks recorded
                </p>
              ) : (
                data?.breaks.map((item, index) => (
                  <BreakItem key={`${item.outAt}-${index}`} item={item} />
                ))
              )}
            </section>

            <section aria-labelledby="view-comments" className="grid gap-2 border-t pt-4">
              <h3 id="view-comments" className="text-xl font-medium text-heading sm:text-2xl">
                Comment
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-grey sm:text-base">
                {day?.comments ?? 'No comments.'}
              </p>
            </section>
          </div>
        )}
      </AppDialog>

      {sub === 'history' && (
        <HistoryDialog
          dayKey={dayKey}
          onClose={() => {
            setSub(null)
          }}
        />
      )}
      {sub === 'logs' && (
        <AttendanceLogDialog
          punches={data?.punches}
          onClose={() => {
            setSub(null)
          }}
        />
      )}
    </>
  )
}
