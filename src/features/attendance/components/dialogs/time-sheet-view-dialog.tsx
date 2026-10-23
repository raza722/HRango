import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, ChevronDown } from 'lucide-react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'

import { useAttendanceDay } from '../../hooks/use-attendance'
import { useBreakTypes } from '../../hooks/use-attendance-settings'
import type { AttendanceBreak, DayKey } from '../../types/attendance.types'
import {
  formatClockTime,
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
  const { nameOf } = useBreakTypes()
  return (
    <details open className="group border-b py-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-base font-medium text-[#202020] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-lg dark:text-heading [&::-webkit-details-marker]:hidden">
        {nameOf(item.type)}
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
          <dt className="font-medium text-title">Description</dt>
          <dd className="mt-1 text-field-value">{item.description || '—'}</dd>
        </div>
      </dl>
    </details>
  )
}

/**
 * Time Sheet View: the person, the day's expected and actual times, the
 * breaks and the comments, with History and Logs (and Edit on All).
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

  return (
    <>
      <AppDialog
        title={`Time sheet of ${data?.profile.name ?? 'employee'}, ${formatLongDate(dayKey.date)}`}
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
            <PersonCard profile={data?.profile} />

            {day && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-field-foreground">
                  {day.status && <StatusPill status={day.status} className="text-sm" />}
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
                  {day.slotName && <span className="text-muted-foreground">· {day.slotName}</span>}
                </div>
                <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2 @3xl:grid-cols-3">
                  <ReadOnlyField
                    tone="view"
                    label="Day"
                    value={formatLongDate(day.date)}
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
                    value={day.checkIn ? formatClockTime(day.checkIn) : '—'}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Expected Check out"
                    value={expected(day.expectedOut)}
                  />
                  <ReadOnlyField
                    tone="view"
                    label="Check Out Time"
                    value={day.checkOut ? formatClockTime(day.checkOut) : '—'}
                  />
                  <div className="flex items-end">
                    <ManualBadge updated={day.manuallyUpdated} />
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
              {data?.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments.</p>
              )}
              {data?.comments.map((comment) => (
                <p key={comment.id} className="text-sm leading-relaxed text-grey sm:text-base">
                  {comment.text}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {comment.author.name} ({comment.author.code}),{' '}
                    {format(parseISO(comment.createdAt), 'd MMMM yyyy, h:mm a')}
                  </span>
                </p>
              ))}
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
          dayKey={dayKey}
          onClose={() => {
            setSub(null)
          }}
        />
      )}
    </>
  )
}
