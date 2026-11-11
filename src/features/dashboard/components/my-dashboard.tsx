import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  CalendarX2,
  Hourglass,
  Inbox,
} from 'lucide-react'

import {
  DAY_STATUS_META,
  DAY_STATUSES,
  type DayStatus,
  summaryQueryOptions,
} from '@/features/attendance'

import {
  dashboardParamsFor,
  dashboardQueryOptions,
  type MyDashboard,
  waitingApprovalsQueryOptions,
} from '../api/dashboard.api'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
import type { DashboardPeriod } from '../routing'
import { formatClock, formatCount, formatDay, formatMonthYear, formatSpan } from '../utils/format'
import { approvalsLink } from '../utils/links'
import {
  EventsWidget,
  LeaveApplicationsWidget,
  NoticeBoardWidget,
  WaitingWidget,
} from './activity-widgets'
import { AttendanceByMonthWidget, AttendanceTodayWidget } from './attendance-widgets'
import { KpiRow, KpiTile } from './kpi-tiles'
import { type QueryState, Section } from './widget'

const isDayStatus = (value: string | null | undefined): value is DayStatus =>
  typeof value === 'string' && (DAY_STATUSES as readonly string[]).includes(value)

/**
 * The employee's own dashboard (`GET /dashboard/me`): the state and times of To (today by
 * default), their days present / absent / on leave in From → To, their leave applications,
 * notices and events, and the requests waiting for them if they approve any. No company-wide
 * figure appears here.
 */
export function MyDashboardView({
  period,
  access,
}: {
  period: DashboardPeriod
  access: DashboardAccess
}) {
  const dashboard = useQuery({
    ...dashboardQueryOptions('me', dashboardParamsFor(period)),
    placeholderData: keepPreviousData,
  })
  // Days present / absent / on leave in From → To: the time sheet's totals, as My Time Sheet shows.
  const sheet = useQuery({
    ...summaryQueryOptions({ scope: 'my', from: period.from, to: period.to }),
    enabled: access.timeSheet,
    placeholderData: keepPreviousData,
  })
  const waiting = useQuery({ ...waitingApprovalsQueryOptions(), enabled: access.approvals })

  function view<T>(pick: (data: MyDashboard) => T): QueryState<T> {
    return {
      data: dashboard.data ? pick(dashboard.data) : undefined,
      isPending: dashboard.isPending,
      isError: dashboard.isError,
      error: dashboard.error,
      refetch: dashboard.refetch,
    }
  }

  const data = dashboard.data
  const loading = dashboard.isPending
  const monthNo = Number(period.month.slice(5, 7))
  const year = Number(period.month.slice(0, 4))
  // The day tile and card show To (today by default).
  const onToday = period.to === period.today
  const today = data?.attendance.rows[0]
  const status = isDayStatus(today?.status) ? today.status : null
  const pending = data?.leaveApplications.filter((item) => item.status === 'pending').length
  const topWaiting = waiting.data?.byType[0]
  // Without the time sheet, the month of To from the dashboard's by-month figures.
  const s = sheet.data
  const byMonth = data?.attendance.byMonth.find((row) => row.month === monthNo)
  const days = access.timeSheet
    ? s && {
        present: s.present + s.halfDay + s.shortDay + s.wfh + s.officialVisit,
        absent: s.absent,
        onLeave: s.leave,
      }
    : data && {
        present: byMonth?.present ?? 0,
        absent: byMonth?.absent ?? 0,
        onLeave: byMonth?.onLeave ?? 0,
      }
  const daysNote = access.timeSheet
    ? formatSpan(period.from, period.to)
    : formatMonthYear(period.month)
  const daysLoading = access.timeSheet ? sheet.isPending : loading
  const sheetLink = (from: string, to: string, dayStatus?: 'absent') =>
    access.timeSheet
      ? {
          to: '/attendance/time-sheet' as const,
          search: { from, to, ...(dayStatus ? { dayStatus } : {}) },
        }
      : undefined

  return (
    <>
      <KpiRow
        label="My key figures"
        columns="six"
        error={
          dashboard.isError
            ? {
                what: 'Your figures',
                error: dashboard.error,
                onRetry: () => {
                  void dashboard.refetch()
                },
              }
            : undefined
        }
      >
        {!dashboard.isError && (
          <>
            <KpiTile
              label={onToday ? 'Today' : formatDay(period.to)}
              value={data ? (status ? DAY_STATUS_META[status].label : 'No shift') : ''}
              note={
                today?.firstIn
                  ? `In ${formatClock(today.firstIn)}${today.lastOut ? `, out ${formatClock(today.lastOut)}` : ''}`
                  : data
                    ? 'Not clocked in'
                    : undefined
              }
              icon={CalendarClock}
              link={sheetLink(period.to, period.to)}
              loading={loading}
            />
            <KpiTile
              label="Days present"
              value={days ? formatCount(days.present) : ''}
              note={daysNote}
              icon={CalendarCheck2}
              link={sheetLink(period.from, period.to)}
              loading={daysLoading}
            />
            <KpiTile
              label="Days absent"
              value={days ? formatCount(days.absent) : ''}
              note={daysNote}
              icon={CalendarX2}
              link={sheetLink(period.from, period.to, 'absent')}
              loading={daysLoading}
            />
            <KpiTile
              label="Days on leave"
              value={days ? formatCount(days.onLeave) : ''}
              note={daysNote}
              icon={CalendarOff}
              link={access.myLeaves ? { to: '/leaves/my-leaves' } : undefined}
              loading={daysLoading}
            />
            <KpiTile
              label="Pending leave requests"
              value={pending === undefined ? '' : formatCount(pending)}
              note="Waiting for approval"
              icon={Hourglass}
              link={
                access.myLeaves
                  ? { to: '/leaves/my-leaves', search: { status: 'pending' } }
                  : undefined
              }
              loading={loading}
            />
          </>
        )}
        {access.approvals && (
          <KpiTile
            label="Approvals waiting for you"
            value={waiting.data ? formatCount(waiting.data.total) : ''}
            note={
              waiting.data
                ? topWaiting
                  ? `Most: ${topWaiting.name} (${formatCount(topWaiting.count)})`
                  : 'Nothing waiting'
                : undefined
            }
            icon={Inbox}
            link={topWaiting ? approvalsLink(topWaiting.type) : undefined}
            loading={waiting.isPending}
            onRetry={
              waiting.isError
                ? () => {
                    void waiting.refetch()
                  }
                : undefined
            }
          />
        )}
      </KpiRow>

      <Section title="My attendance">
        <div className="grid gap-4 sm:gap-5 @3xl/page:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <AttendanceTodayWidget
            query={view((item) => item.attendance)}
            title={onToday ? 'My attendance today' : `My attendance on ${formatDay(period.to)}`}
            link={sheetLink(period.to, period.to)}
            personal
          />
          <AttendanceByMonthWidget
            query={view((item) => item.attendance)}
            title="My attendance by month"
            unit="days"
            year={year}
            month={monthNo}
            // The API counts the months up to To.
            lastMonth={monthNo}
          />
        </div>
      </Section>

      <Section title="Requests and news">
        <div className="grid gap-4 sm:gap-5 @2xl/page:grid-cols-2 @[96rem]/page:grid-cols-4">
          <LeaveApplicationsWidget
            query={view((item) => item.leaveApplications)}
            title="My leave applications"
            showPerson={false}
            link={access.myLeaves ? { to: '/leaves/my-leaves' } : undefined}
          />
          {access.approvals && <WaitingWidget query={waiting} />}
          <NoticeBoardWidget query={view((item) => item.noticeBoard)} />
          <EventsWidget query={view((item) => item.upcomingEvents)} />
        </div>
      </Section>
    </>
  )
}
