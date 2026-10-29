import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  CalendarX2,
  Hourglass,
  Inbox,
} from 'lucide-react'

import { DAY_STATUS_META, DAY_STATUSES, type DayStatus } from '@/features/attendance'

import {
  dashboardParamsFor,
  dashboardQueryOptions,
  type MyDashboard,
  waitingApprovalsQueryOptions,
} from '../api/dashboard.api'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
import { formatClock, formatCount, formatMonthYear } from '../utils/format'
import { approvalsLink } from '../utils/links'
import {
  EventsWidget,
  LeaveApplicationsWidget,
  NoticeBoardWidget,
  WaitingWidget,
} from './activity-widgets'
import { AttendanceByMonthWidget, AttendanceTodayWidget } from './attendance-widgets'
import { KpiRow, KpiTile } from './kpi-tiles'
import type { DashboardPeriod } from './org-dashboard'
import { type QueryState, Section } from './widget'

const isDayStatus = (value: string | null | undefined): value is DayStatus =>
  typeof value === 'string' && (DAY_STATUSES as readonly string[]).includes(value)

/**
 * The employee's own dashboard (`GET /dashboard/me`): today's state and times, this month's
 * days, their leave applications, notices and events, and the requests waiting for them if they
 * approve any. No company-wide figure appears here.
 */
export function MyDashboardView({
  period,
  access,
}: {
  period: DashboardPeriod
  access: DashboardAccess
}) {
  const params = dashboardParamsFor(period.month === period.currentMonth ? undefined : period.month)
  const dashboard = useQuery({
    ...dashboardQueryOptions('me', params),
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
  const mine = data?.attendance.byMonth.find((row) => row.month === monthNo)
  const today = data?.attendance.rows[0]
  const status = isDayStatus(today?.status) ? today.status : null
  const pending = data?.leaveApplications.filter((item) => item.status === 'pending').length
  const topWaiting = waiting.data?.byType[0]
  const lastMonth =
    period.month.slice(0, 4) < period.currentMonth.slice(0, 4)
      ? 12
      : Number(period.currentMonth.slice(5, 7))
  const monthLabel = formatMonthYear(period.month)
  const myTimeSheet = access.timeSheet ? { to: '/attendance/time-sheet' as const } : undefined

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
              label="Today"
              value={data ? (status ? DAY_STATUS_META[status].label : 'No shift') : ''}
              note={
                today?.firstIn
                  ? `In ${formatClock(today.firstIn)}${today.lastOut ? `, out ${formatClock(today.lastOut)}` : ''}`
                  : data
                    ? 'Not clocked in'
                    : undefined
              }
              icon={CalendarClock}
              link={myTimeSheet}
              loading={loading}
            />
            <KpiTile
              label="Days present"
              value={data ? formatCount(mine?.present ?? 0) : ''}
              note={monthLabel}
              icon={CalendarCheck2}
              link={myTimeSheet}
              loading={loading}
            />
            <KpiTile
              label="Days absent"
              value={data ? formatCount(mine?.absent ?? 0) : ''}
              note={monthLabel}
              icon={CalendarX2}
              link={myTimeSheet}
              loading={loading}
            />
            <KpiTile
              label="Days on leave"
              value={data ? formatCount(mine?.onLeave ?? 0) : ''}
              note={monthLabel}
              icon={CalendarOff}
              link={access.myLeaves ? { to: '/leaves/my-leaves' } : undefined}
              loading={loading}
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
            title="My attendance today"
            link={myTimeSheet}
            personal
          />
          <AttendanceByMonthWidget
            query={view((item) => item.attendance)}
            title="My attendance by month"
            unit="days"
            year={year}
            month={monthNo}
            lastMonth={lastMonth}
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
