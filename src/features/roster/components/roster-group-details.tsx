import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { ENROLLMENT_DATE_FORMAT, ROSTER_DAY_LABELS } from '../constants'
import { ROSTER_DAYS, type RosterGroupDay, type RosterGroupDetail } from '../types/roster.types'
import { ShiftMinutes, SlotTimes } from './shift-minutes'
import { rosterType } from './type-styles'

const headClass = 'px-3 py-3 text-left text-sm font-medium whitespace-nowrap text-heading'
const cellClass = 'border-t px-3 py-2.5 align-middle'
const valueBoxClass =
  'flex h-10 min-w-0 items-center rounded-md border border-input bg-card px-3 tabular-nums sm:px-4'
// Figma View: times Inter Medium 16 #585858, the group title Inter Medium 16 #303030.
const timeBoxClass = cn(valueBoxClass, rosterType.time)
const titleBoxClass = cn(valueBoxClass, 'text-base font-medium text-title')

const showDate = (value: string | null) =>
  value ? format(parseISO(value), ENROLLMENT_DATE_FORMAT) : 'Open-ended'

function Value({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-3">
      <dt className="text-sm leading-none text-label">{label}</dt>
      <dd className={timeBoxClass}>{children}</dd>
    </div>
  )
}

function DayOffBadge({ isDayOff }: { isDayOff: boolean }) {
  return isDayOff ? (
    <Badge variant="secondary" className="font-normal">
      Day off
    </Badge>
  ) : (
    <span className="text-sm text-muted-foreground">Working day</span>
  )
}

/** The seven days, Monday first, whatever the API sends. */
function weekOf(group: RosterGroupDetail): { label: string; day: RosterGroupDay | undefined }[] {
  return ROSTER_DAYS.map((name, index) => ({
    label: ROSTER_DAY_LABELS[name],
    day: group.days.find((item) => item.weekday === index + 1),
  }))
}

const slotName = (day: RosterGroupDay | undefined) =>
  !day || day.isDayOff
    ? '—'
    : `${day.timeSlotName ?? 'Time slot'}${day.timeSlotCode ? ` (${day.timeSlotCode})` : ''}`

function DayTable({ group }: { group: RosterGroupDetail }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Weekly schedule</caption>
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className={cn(headClass, 'w-10')}>
              #
            </th>
            <th scope="col" className={headClass}>
              Day Name
            </th>
            <th scope="col" className={cn(headClass, 'w-28')}>
              Day Off
            </th>
            <th scope="col" className={headClass}>
              Time Slot
            </th>
            <th scope="col" className={headClass}>
              Times
            </th>
            <th scope="col" className={cn(headClass, 'w-48')}>
              Defined Minutes
            </th>
          </tr>
        </thead>
        <tbody>
          {weekOf(group).map(({ label, day }, index) => {
            const isDayOff = !day || day.isDayOff
            return (
              <tr key={label}>
                <td className={cn(cellClass, 'text-muted-foreground tabular-nums')}>{index + 1}</td>
                <th
                  scope="row"
                  className={cn(cellClass, 'text-left font-normal text-nav-active-foreground')}
                >
                  {label}
                </th>
                <td className={cellClass}>
                  <DayOffBadge isDayOff={isDayOff} />
                </td>
                <td className={cn(cellClass, 'text-title')}>{slotName(day)}</td>
                <td className={cellClass}>
                  <SlotTimes slot={day} isDayOff={isDayOff} className={rosterType.time} />
                </td>
                <td className={cellClass}>
                  <ShiftMinutes
                    className={rosterType.time}
                    label={`${label} defined minutes`}
                    clockIn={day?.startTime ?? null}
                    clockOut={day?.endTime ?? null}
                    isWeekend={isDayOff}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DayCards({ group }: { group: RosterGroupDetail }) {
  return (
    <ul className="grid gap-3">
      {weekOf(group).map(({ label, day }, index) => {
        const isDayOff = !day || day.isDayOff
        return (
          <li key={label} className="grid gap-3 rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base text-nav-active-foreground">
                <span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                {label}
              </h3>
              <DayOffBadge isDayOff={isDayOff} />
            </div>
            {!isDayOff && (
              <dl className="grid grid-cols-2 gap-3">
                <Value label="Time Slot">{slotName(day)}</Value>
                <Value label="Times">
                  <SlotTimes slot={day} isDayOff={false} className={rosterType.time} />
                </Value>
              </dl>
            )}
            <ShiftMinutes
              className={rosterType.time}
              label={`${label} defined minutes`}
              clockIn={day?.startTime ?? null}
              clockOut={day?.endTime ?? null}
              isWeekend={isDayOff}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** The "View" modal body: the group as drawn, read-only. */
export function RosterGroupDetails({ group }: { group: RosterGroupDetail }) {
  const isWide = useMediaQuery(BREAKPOINTS.md)

  return (
    <div className="grid gap-6">
      <dl className="grid gap-5 @2xl:grid-cols-4 @2xl:gap-x-6">
        <div className="grid content-start gap-3 @2xl:col-span-2">
          <dt className="text-sm leading-none text-label">Group Title</dt>
          <dd className={titleBoxClass}>{group.title}</dd>
        </div>
        <div className="grid content-start gap-3 @2xl:col-span-2">
          <dt className="text-sm leading-none text-label">Status</dt>
          <dd className="flex min-h-10 items-center">
            <Badge
              variant="outline"
              className={cn(
                'font-normal',
                group.isActive ? 'border-success/40 text-success' : 'text-muted-foreground',
              )}
            >
              {group.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </dd>
        </div>
        <Value label="From Date">{showDate(group.fromDate)}</Value>
        <Value label="To Date">{showDate(group.toDate)}</Value>
        <div className="grid content-start gap-3 @2xl:col-span-2">
          <dt className="text-sm leading-none text-label">Description</dt>
          <dd className="flex min-h-10 items-center text-sm text-field-foreground">
            {group.description ?? '—'}
          </dd>
        </div>
      </dl>
      {isWide ? <DayTable group={group} /> : <DayCards group={group} />}
    </div>
  )
}
