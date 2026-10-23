import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { BREAK_TYPE_LABELS } from '../../constants'
import { useRosterTones } from '../../hooks/use-roster-tones'
import { useGeoFences } from '../../hooks/use-scheduling'
import type { ScheduleEntry } from '../../types/scheduling.types'
import { formatHours, formatHoursText, plannedMinutes } from '../../utils/shift-hours'
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

/** View Scheduling: one day read-only, with Edit to change it. */
export function ViewEntryDialog({
  entry,
  onClose,
  onEdit,
}: {
  entry: ScheduleEntry
  onClose: () => void
  onEdit: () => void
}) {
  const tones = useRosterTones()
  const fences = useGeoFences()
  const fenceNames = entry.geoFenceIds.map(
    (id) => fences.data?.find((fence) => fence.id === id)?.name ?? id,
  )
  const isShift = entry.kind === 'shift'

  return (
    <SchedulingDialog
      title="View Scheduling"
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onEdit} className={dialogButtonClass}>
            <Pencil /> Edit
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <DateRow date={entry.date} />
        <dl className="grid gap-5">
          <Row label="Time Roster">{tones.titleOf(entry.rosterGroupId) ?? entry.slot.name}</Row>
          {isShift && (
            <Row label="Time">
              <span className="tabular-nums">
                {entry.clockIn ? formatTimeValue(entry.clockIn) : '—'} –{' '}
                {entry.clockOut ? formatTimeValue(entry.clockOut) : '—'}
              </span>
              <span className="text-muted-foreground">
                · {formatHours(plannedMinutes(entry))} planned
              </span>
              {entry.slot.isOvernight && (
                <span className="text-muted-foreground">· ends next day</span>
              )}
            </Row>
          )}
          <Row label="Apply Geo Fence">
            {fenceNames.length === 0 ? (
              <span className="text-label">None</span>
            ) : (
              fenceNames.map((name) => (
                <span key={name} className="rounded-sm bg-chip px-1.5 py-0.5 text-xs dark:bg-input">
                  {name}
                </span>
              ))
            )}
          </Row>
          {entry.breaks.length > 0 && (
            <Row label="Breaks">
              {entry.breaks.map((item) => (
                <span
                  key={`${item.type}-${item.startTime}`}
                  className="rounded-sm bg-muted px-1.5 py-0.5 text-xs"
                >
                  {BREAK_TYPE_LABELS[item.type]} {formatTimeValue(item.startTime)}–
                  {formatTimeValue(item.endTime)}
                  {item.inclusive ? ' (paid)' : ''}
                </span>
              ))}
            </Row>
          )}
          {entry.slot.overtimeMinutes !== null && (
            <Row label="Overtime">{formatHoursText(entry.slot.overtimeMinutes)}</Row>
          )}
        </dl>
        <div className="flex flex-wrap gap-x-10 gap-y-3 @xl:pl-[calc(10rem+1.5rem)]">
          <Flag label="Full Overtime" checked={entry.slot.fullOvertime} />
          <Flag label="Rest Days" checked={entry.kind === 'rest'} />
          <Flag label="Work From Home" checked={entry.workFromHome} />
        </div>
      </div>
    </SchedulingDialog>
  )
}
