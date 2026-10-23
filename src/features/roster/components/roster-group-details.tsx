import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { ROSTER_DAY_LABELS } from '../constants'
import type { RosterDaySchedule, RosterGroup } from '../types/roster.types'
import { ShiftMinutes } from './shift-minutes'
import { rosterType } from './type-styles'

const headClass = 'px-3 py-3 text-left text-sm font-medium whitespace-nowrap text-heading'
const cellClass = 'border-t px-3 py-2.5 align-middle'
const valueBoxClass =
  'flex h-10 min-w-0 items-center rounded-md border border-input bg-card px-3 tabular-nums sm:px-4'
// Figma View: times Inter Medium 16 #585858, the group title Inter Medium 16 #303030.
const timeBoxClass = cn(valueBoxClass, rosterType.time)
const titleBoxClass = cn(valueBoxClass, 'text-base font-medium text-title')

const time = (value: string | null) => (value ? formatTimeValue(value) : '—')

function Value({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-3">
      <dt className="text-sm leading-none text-label">{label}</dt>
      <dd className={timeBoxClass}>{children}</dd>
    </div>
  )
}

function WeekendBadge({ isWeekend }: { isWeekend: boolean }) {
  return isWeekend ? (
    <Badge variant="secondary" className="font-normal">
      Weekend
    </Badge>
  ) : (
    <span className="text-sm text-muted-foreground">Working day</span>
  )
}

function DayTable({ days }: { days: readonly RosterDaySchedule[] }) {
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
              Weekend
            </th>
            <th scope="col" className={headClass}>
              Clock In
            </th>
            <th scope="col" className={headClass}>
              Clock Out
            </th>
            <th scope="col" className={cn(headClass, 'w-48')}>
              Defined Minutes
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => {
            const label = ROSTER_DAY_LABELS[day.day]
            return (
              <tr key={day.day}>
                <td className={cn(cellClass, 'text-muted-foreground tabular-nums')}>{index + 1}</td>
                <th
                  scope="row"
                  className={cn(cellClass, 'text-left font-normal text-nav-active-foreground')}
                >
                  {label}
                </th>
                <td className={cellClass}>
                  <WeekendBadge isWeekend={day.isWeekend} />
                </td>
                <td className={cellClass}>
                  <span className={timeBoxClass}>{time(day.clockIn)}</span>
                </td>
                <td className={cellClass}>
                  <span className={timeBoxClass}>{time(day.clockOut)}</span>
                </td>
                <td className={cellClass}>
                  <ShiftMinutes
                    className={rosterType.time}
                    label={`${label} defined minutes`}
                    clockIn={day.clockIn}
                    clockOut={day.clockOut}
                    isWeekend={day.isWeekend}
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

function DayCards({ days }: { days: readonly RosterDaySchedule[] }) {
  return (
    <ul className="grid gap-3">
      {days.map((day, index) => {
        const label = ROSTER_DAY_LABELS[day.day]
        return (
          <li key={day.day} className="grid gap-3 rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base text-nav-active-foreground">
                <span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                {label}
              </h3>
              <WeekendBadge isWeekend={day.isWeekend} />
            </div>
            {!day.isWeekend && (
              <dl className="grid grid-cols-2 gap-3">
                <Value label="Clock In">{time(day.clockIn)}</Value>
                <Value label="Clock Out">{time(day.clockOut)}</Value>
              </dl>
            )}
            <ShiftMinutes
              className={rosterType.time}
              label={`${label} defined minutes`}
              clockIn={day.clockIn}
              clockOut={day.clockOut}
              isWeekend={day.isWeekend}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** The "View" modal body: the group as drawn, read-only. */
export function RosterGroupDetails({ group }: { group: RosterGroup }) {
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
        <Value label="Clock In">{time(group.clockIn)}</Value>
        <Value label="Clock Out">{time(group.clockOut)}</Value>
        <div className="grid content-start gap-3">
          <dt className="text-sm leading-none text-label">Defined Minutes</dt>
          <dd>
            <ShiftMinutes
              className={rosterType.time}
              label="Defined minutes"
              clockIn={group.clockIn}
              clockOut={group.clockOut}
            />
          </dd>
        </div>
        <div className="grid content-start gap-3">
          <dt className="text-sm leading-none text-label">Apply For All</dt>
          <dd className="flex min-h-10 items-center text-sm text-field-foreground">
            {group.applyToAll ? 'Yes, every working day' : 'No, set per day'}
          </dd>
        </div>
      </dl>
      {isWide ? <DayTable days={group.days} /> : <DayCards days={group.days} />}
    </div>
  )
}
