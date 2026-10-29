import { useState } from 'react'
import { format } from 'date-fns'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { DAY_STATUS_META, DAY_STATUSES, type DayStatus } from '@/features/attendance'

import type { AttendanceRow, DashboardAttendance } from '../api/dashboard.api'
import {
  formatClock,
  formatCount,
  formatDay,
  formatPercent,
  plural,
  shareOf,
} from '../utils/format'
import type { DashLink } from '../utils/links'
import { ChartFigure, ColumnChart, PartBar } from './charts'
import { Figure, type QueryState, Widget, WidgetBody, WidgetLink } from './widget'

const MONTHS = Array.from({ length: 12 }, (_, index) => format(new Date(2024, index, 1), 'MMM'))
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2024, index, 1), 'MMMM'),
)

const OFF_DAYS = new Set(['weekend', 'rest_day', 'holiday', 'sandwich'])

const isDayStatus = (value: string | null): value is DayStatus =>
  value !== null && (DAY_STATUSES as readonly string[]).includes(value)

/**
 * The day as a part of a whole: present, absent and on leave out of everyone expected at work,
 * with the absenteeism rate, who has not started yet and who is off.
 */
export function AttendanceTodayWidget({
  query,
  title,
  link,
  personal = false,
}: {
  query: QueryState<DashboardAttendance>
  title: string
  link?: DashLink | undefined
  /** One person's day (the employee dashboard): their state, not shares. */
  personal?: boolean
}) {
  return (
    <Widget
      title={title}
      description={query.data ? formatDay(query.data.day) : undefined}
      action={link && <WidgetLink link={link} label="Time sheet" name="Open the time sheet" />}
    >
      <WidgetBody
        query={query}
        what={title}
        skeleton="figures"
        isEmpty={(data) => data.rows.length === 0}
        empty={personal ? 'You have no shift today.' : 'Nobody has a shift today.'}
      >
        {(data) => (personal ? <MyDay attendance={data} /> : <TeamDay attendance={data} />)}
      </WidgetBody>
    </Widget>
  )
}

function TeamDay({ attendance }: { attendance: DashboardAttendance }) {
  const expected = attendance.present + attendance.absent + attendance.onLeave
  const notStarted = attendance.rows.filter((row) => row.status === 'yet_to_start').length
  const off = attendance.rows.filter((row) => OFF_DAYS.has(row.status ?? '')).length
  return (
    <div className="grid gap-4">
      {expected > 0 ? (
        <p className="text-sm text-field-foreground">
          <span className="text-3xl font-semibold text-heading">
            {formatCount(attendance.present)}
          </span>{' '}
          of {plural(expected, 'person', 'people')} expected {expected === 1 ? 'is' : 'are'} at work
        </p>
      ) : (
        <p className="text-sm text-field-foreground">Nobody is expected at work yet.</p>
      )}
      <PartBar
        label="Attendance today"
        parts={[
          { key: 'present', label: 'Present', value: attendance.present, tone: 1 },
          { key: 'absent', label: 'Absent', value: attendance.absent, tone: 2 },
          { key: 'leave', label: 'On leave', value: attendance.onLeave, tone: 3 },
        ]}
      />
      <dl className="grid grid-cols-3 gap-2">
        <Figure label="Absenteeism" value={formatPercent(attendance.absenteeismPercent)} />
        <Figure label="Not started" value={formatCount(notStarted)} />
        <Figure label="Day off" value={formatCount(off)} />
      </dl>
    </div>
  )
}

function MyDay({ attendance }: { attendance: DashboardAttendance }) {
  const row = attendance.rows[0]
  const status = isDayStatus(row?.status ?? null) ? (row?.status as DayStatus) : null
  return (
    <div className="grid gap-4">
      {status && (
        <p className="flex items-center gap-2 text-2xl font-semibold text-heading">
          <img src={DAY_STATUS_META[status].icon} alt="" className="size-6" />
          {DAY_STATUS_META[status].label}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2">
        <Figure label="First in" value={formatClock(row?.firstIn ?? null)} />
        <Figure label="Last out" value={formatClock(row?.lastOut ?? null)} />
      </dl>
    </div>
  )
}

/**
 * Days worked, absent and on leave per month of the year so far, stacked (a person-day each;
 * one person's days on the employee dashboard), with the absenteeism rate in the tooltip and
 * the table.
 */
export function AttendanceByMonthWidget({
  query,
  year,
  month,
  lastMonth,
  title = 'Attendance by month',
  unit = 'person-days',
}: {
  query: QueryState<DashboardAttendance>
  year: number
  /** The chosen month, 1–12 (marked on the axis). */
  month: number
  /** The last month with figures (this month for this year). */
  lastMonth: number
  title?: string
  unit?: string
}) {
  const count = Math.max(1, Math.min(12, lastMonth))
  return (
    <Widget title={title} description={`${String(year)}, ${unit}`}>
      <WidgetBody
        query={query}
        what={title}
        isEmpty={(data) =>
          data.byMonth.every((row) => row.present + row.absent + row.onLeave === 0)
        }
        empty={`No attendance is recorded for ${String(year)} yet.`}
      >
        {(data) => {
          const rows = Array.from({ length: count }, (_, index) => {
            const row = data.byMonth.find((item) => item.month === index + 1)
            return {
              present: row?.present ?? 0,
              absent: row?.absent ?? 0,
              onLeave: row?.onLeave ?? 0,
            }
          })
          const rate = (index: number) => {
            const row = rows[index]
            return row ? shareOf(row.absent, row.present + row.absent + row.onLeave) : 0
          }
          return (
            <ChartFigure
              label={title.toLowerCase()}
              legend={[
                { key: 'present', label: 'Present', tone: 1 },
                { key: 'absent', label: 'Absent', tone: 2 },
                { key: 'leave', label: 'On leave', tone: 3 },
              ]}
              table={{
                caption: `${title}, ${String(year)}`,
                head: ['Month', 'Present', 'Absent', 'On leave', 'Absenteeism'],
                rows: rows.map((row, index) => ({
                  key: String(index),
                  cells: [
                    MONTH_NAMES[index] ?? '',
                    formatCount(row.present),
                    formatCount(row.absent),
                    formatCount(row.onLeave),
                    formatPercent(rate(index)),
                  ],
                })),
              }}
            >
              <ColumnChart
                label={`${title}, ${String(year)}: present, absent and on leave per month`}
                labels={MONTHS.slice(0, count)}
                longLabels={MONTH_NAMES.slice(0, count).map((name) => `${name} ${String(year)}`)}
                stacked
                highlight={month - 1}
                series={[
                  {
                    key: 'present',
                    label: 'Present',
                    tone: 1,
                    values: rows.map((row) => row.present),
                  },
                  {
                    key: 'absent',
                    label: 'Absent',
                    tone: 2,
                    values: rows.map((row) => row.absent),
                  },
                  {
                    key: 'leave',
                    label: 'On leave',
                    tone: 3,
                    values: rows.map((row) => row.onLeave),
                  },
                ]}
                extra={(index) => [
                  { key: 'rate', label: 'Absenteeism', value: formatPercent(rate(index)) },
                ]}
              />
            </ChartFigure>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

const SHORT_LIST = 8

/** Who came in first leads; people not in yet follow, by name. */
function byFirstIn(a: AttendanceRow, b: AttendanceRow): number {
  if (a.firstIn && b.firstIn && a.firstIn !== b.firstIn) return a.firstIn < b.firstIn ? -1 : 1
  if (a.firstIn && !b.firstIn) return -1
  if (!a.firstIn && b.firstIn) return 1
  return a.employeeName.localeCompare(b.employeeName)
}

const columns: DataTableColumn<AttendanceRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    className: 'min-w-44 whitespace-normal',
    cell: (row) => (
      <span className="grid">
        <span className="font-medium text-heading">{row.employeeName}</span>
        {row.designationName && (
          <span className="text-xs text-muted-foreground">{row.designationName}</span>
        )}
      </span>
    ),
  },
  { id: 'in', header: 'First in', cell: (row) => formatClock(row.firstIn) },
  { id: 'out', header: 'Last out', cell: (row) => formatClock(row.lastOut) },
  {
    id: 'status',
    header: 'Status',
    cell: (row) =>
      isDayStatus(row.status) ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <img src={DAY_STATUS_META[row.status].icon} alt="" className="size-4" />
          {DAY_STATUS_META[row.status].label}
        </span>
      ) : (
        '—'
      ),
  },
]

/** Today's time sheet rows: who is in (earliest first), with first in, last out and the state. */
export function WhosInWidget({
  query,
  link,
}: {
  query: QueryState<DashboardAttendance>
  link?: DashLink | undefined
}) {
  const [all, setAll] = useState(false)
  return (
    <Widget
      title="Who’s in today"
      description={
        query.data
          ? `${plural(query.data.rows.filter((row) => row.firstIn).length, 'person', 'people')} clocked in`
          : undefined
      }
      action={link && <WidgetLink link={link} label="Time sheet" name="Open today’s time sheet" />}
    >
      <WidgetBody
        query={query}
        what="Who’s in today"
        skeleton="list"
        isEmpty={(data) => data.rows.length === 0}
        empty="Nobody has a shift today."
      >
        {(data) => {
          const sorted = data.rows.toSorted(byFirstIn)
          const rows = all ? sorted : sorted.slice(0, SHORT_LIST)
          return (
            <div className="grid gap-3">
              <DataTable
                caption="Who’s in today"
                columns={columns}
                data={rows}
                getRowId={(row) => row.employeeId}
              />
              {data.rows.length > SHORT_LIST && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => {
                    setAll((value) => !value)
                  }}
                >
                  {all ? 'Show fewer' : `Show all ${formatCount(data.rows.length)}`}
                </Button>
              )}
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}
