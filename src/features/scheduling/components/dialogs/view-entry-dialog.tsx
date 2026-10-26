import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { useSchedule } from '../../hooks/use-scheduling'
import type { BoardRestDay } from '../../types/scheduling.types'
import { clockOf, formatHours } from '../../utils/shift-hours'
import { schedulingType } from '../type-styles'
import { DateRow } from './edit-entry-dialog'
import { SchedulingDialog } from './scheduling-dialog'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className={cn('@xl:py-2', schedulingType.label)}>{label}</dt>
      <dd
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input px-3 py-1.5 sm:px-4',
          schedulingType.value,
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function Flag({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', schedulingType.label)}>
      {label}
      <Checkbox checked={checked} disabled aria-label={label} />
    </span>
  )
}

const clock = (dateTime: string) => {
  const time = clockOf(dateTime)
  return time ? formatTimeValue(time) : '—'
}

/** View Scheduling (`GET /scheduling/schedules/{id}`): one shift read-only, with Edit. */
export function ViewEntryDialog({
  shiftId,
  onClose,
  onEdit,
}: {
  shiftId: string
  onClose: () => void
  /** Left out when the user may not edit shifts. */
  onEdit?: (() => void) | undefined
}) {
  const query = useSchedule(shiftId)
  const shift = query.data

  return (
    <SchedulingDialog
      title="View Scheduling"
      description={shift ? `${shift.employeeName} (${shift.employeeCode})` : undefined}
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          {onEdit && (
            <Button variant="outline" size="lg" onClick={onEdit} className={dialogButtonClass}>
              <Pencil /> Edit
            </Button>
          )}
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      {!shift ? (
        query.error ? (
          <ErrorState
            message={query.error.message}
            onRetry={() => {
              void query.refetch()
            }}
            className="shadow-none"
          />
        ) : (
          <Skeleton className="h-64 w-full" />
        )
      ) : (
        <div className="grid gap-5">
          <DateRow date={shift.workDate} />
          <dl className="grid gap-5">
            <Row label="Time Slot">
              {shift.timeSlotName}
              <span className="text-muted-foreground">({shift.timeSlotCode})</span>
            </Row>
            <Row label="Time">
              <span className="tabular-nums">
                {clock(shift.startAt)} – {clock(shift.endAt)}
              </span>
              <span className="text-muted-foreground">
                · {formatHours(shift.plannedMinutes)} planned
              </span>
              {shift.isOvernight && <span className="text-muted-foreground">· ends next day</span>}
              {shift.isFlexible && <span className="text-muted-foreground">· flexible</span>}
            </Row>
            <Row label="Apply Geo Fence">
              {shift.geoFenceName ?? <span className="text-label">None</span>}
            </Row>
            {shift.breaks.length > 0 && (
              <Row label="Breaks">
                {shift.breaks.map((item) => (
                  <span key={item.id} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                    {item.breakTypeName} {clock(item.startAt)}–{clock(item.endAt)}
                    {item.isInclusive ? ' (paid)' : ''}
                  </span>
                ))}
              </Row>
            )}
          </dl>
          <div className="flex flex-wrap gap-x-10 gap-y-3 @xl:pl-[calc(10rem+1.5rem)]">
            <Flag label="Full Overtime" checked={shift.fullOvertime} />
            <Flag label="Short Overtime" checked={shift.shortOvertime} />
            <Flag label="Rest Day" checked={shift.isRestDay} />
            <Flag label="Work From Home" checked={shift.isWfh} />
          </div>
        </div>
      )}
    </SchedulingDialog>
  )
}

/** A rest day on the board, read-only (the board sends all there is to know). */
export function ViewRestDayDialog({
  restDay,
  employeeName,
  onClose,
}: {
  restDay: BoardRestDay
  employeeName: string
  onClose: () => void
}) {
  return (
    <SchedulingDialog
      title="Rest Day"
      description={employeeName}
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5">
        <DateRow date={restDay.restDate} />
        <dl className="grid gap-5">
          <Row label="Payable">{restDay.isPayable ? 'Yes, a paid rest day' : 'No, a day off'}</Row>
          <Row label="Made by">
            {restDay.requestId
              ? 'An approved rest-day request'
              : restDay.restDayRuleId
                ? 'A rest-day rule (Scheduling settings)'
                : 'Scheduling'}
          </Row>
        </dl>
      </div>
    </SchedulingDialog>
  )
}
