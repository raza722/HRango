import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format, parse } from 'date-fns'
import {
  BriefcaseBusiness,
  CalendarOff,
  Inbox,
  Percent,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'

import { summaryQueryOptions } from '@/features/attendance'
import { cn } from '@/lib/utils'

import {
  type CeoDashboard,
  dashboardParamsFor,
  dashboardQueryOptions,
  type HrDashboard,
  waitingApprovalsQueryOptions,
} from '../api/dashboard.api'
import { openOpeningsQueryOptions } from '../api/module-queries'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
import type { DashboardPeriod } from '../routing'
import {
  formatChange,
  formatCount,
  formatDay,
  formatMonthYear,
  formatPercent,
  plural,
  shareOf,
} from '../utils/format'
import { approvalsLink, timeSheetLink } from '../utils/links'
import {
  EventsWidget,
  LeaveApplicationsWidget,
  NoticeBoardWidget,
  WaitingWidget,
} from './activity-widgets'
import { AttendanceByMonthWidget, AttendanceTodayWidget, WhosInWidget } from './attendance-widgets'
import { type KpiDelta, KpiRow, KpiTile } from './kpi-tiles'
import { ModuleCards } from './module-cards'
import { type QueryState, Section } from './widget'
import {
  DepartmentWidget,
  EmploymentTypeWidget,
  GenderAgeWidget,
  TurnoverWidget,
  WomenByTitleWidget,
} from './workforce-widgets'

const monthName = (value: string) => format(parse(value.slice(0, 7), 'yyyy-MM', new Date()), 'MMMM')

/** A change against last month, for a tile's delta line. */
function deltaOf(
  now: number,
  before: number | undefined,
  beforeMonth: string | undefined,
): KpiDelta | undefined {
  if (before === undefined || beforeMonth === undefined) return undefined
  return {
    text: formatChange(now - before),
    against: `vs ${monthName(beforeMonth)}`,
    direction: now > before ? 'up' : now < before ? 'down' : 'flat',
  }
}

/**
 * The HR and CEO dashboards: the key figures, attendance, the workforce, the module cards and
 * recent activity, from `GET /dashboard/hr` (or `/ceo`) and the modules' own summaries. The CEO
 * dashboard has no personal items (approvals waiting for the caller, notices and events).
 *
 * The attendance tiles cover From → To from the time sheet's own totals, so they match the Time
 * Sheet they open; one day reads as people, several as person-days. The attendance card and Who's
 * in show To; the monthly figures the month of To.
 */
export function OrgDashboard({
  kind,
  period,
  access,
}: {
  kind: 'hr' | 'ceo'
  period: DashboardPeriod
  access: DashboardAccess
}) {
  const personal = kind === 'hr'
  const dashboard = useQuery({
    ...dashboardQueryOptions(kind, dashboardParamsFor(period)),
    placeholderData: keepPreviousData,
  })
  const sheet = useQuery({
    ...summaryQueryOptions({ scope: 'all', from: period.from, to: period.to }),
    enabled: access.timeSheet,
    placeholderData: keepPreviousData,
  })
  const openings = useQuery({ ...openOpeningsQueryOptions(), enabled: access.openings })
  const waiting = useQuery({
    ...waitingApprovalsQueryOptions(),
    enabled: personal && access.approvals,
  })

  function view<T>(pick: (data: HrDashboard | CeoDashboard) => T): QueryState<T> {
    return {
      data: dashboard.data ? pick(dashboard.data) : undefined,
      isPending: dashboard.isPending,
      isError: dashboard.isError,
      error: dashboard.error,
      refetch: dashboard.refetch,
    }
  }
  const workforce = view((data) => data.workforce)
  const attendance = view((data) => data.attendance)
  const hr = dashboard.data && 'noticeBoard' in dashboard.data ? dashboard.data : undefined

  const w = dashboard.data?.workforce
  const a = dashboard.data?.attendance
  const loading = dashboard.isPending
  const previous = w?.turnoverByMonth.at(-2)
  const day = a?.day ?? period.to
  const onToday = day === period.today
  const topWaiting = waiting.data?.byType[0]
  const year = Number(period.month.slice(0, 4))
  const monthNo = Number(period.month.slice(5, 7))

  // The tiles: the time sheet's totals for From → To ("Present" counts the days worked: present,
  // half and short days, WFH, official visits). Without the time sheet, the dashboard's day.
  const s = sheet.data
  const shown = access.timeSheet
    ? s && {
        present: s.present + s.halfDay + s.shortDay + s.wfh + s.officialVisit,
        absent: s.absent,
        onLeave: s.leave,
      }
    : a && { present: a.present, absent: a.absent, onLeave: a.onLeave }
  const severalDays = access.timeSheet && period.from !== period.to
  const tileDay = access.timeSheet ? period.to : day
  const tileToday = tileDay === period.today
  const expected = shown ? shown.present + shown.absent + shown.onLeave : 0
  const days = { from: period.from, to: period.to }
  const tilesLoading = access.timeSheet ? sheet.isPending : loading
  const tilesRetry =
    access.timeSheet && sheet.isError
      ? () => {
          void sheet.refetch()
        }
      : undefined

  return (
    <>
      <KpiRow
        label="Key figures"
        error={
          dashboard.isError
            ? {
                what: 'The key figures',
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
              label="Headcount"
              value={w ? formatCount(w.headcount) : ''}
              note={w ? `${formatPercent(w.womenPercent)} women` : undefined}
              icon={Users}
              link={access.employees ? { to: '/talent-management/employees' } : undefined}
              loading={loading}
            />
            <KpiTile
              label={
                severalDays
                  ? 'Present'
                  : tileToday
                    ? 'Present today'
                    : `Present on ${formatDay(tileDay)}`
              }
              value={shown ? formatCount(shown.present) : ''}
              // Out of everyone expected at work, as the Attendance card and absenteeism count it
              // (not headcount: days off and shifts not yet started would pull the share down).
              note={
                shown
                  ? expected > 0
                    ? `of ${formatCount(expected)} expected${severalDays ? ' person-days' : ''} · ${formatPercent(shareOf(shown.present, expected))}`
                    : 'Nobody expected yet'
                  : undefined
              }
              icon={UserCheck}
              link={access.timeSheet ? timeSheetLink(days) : undefined}
              loading={tilesLoading}
              onRetry={tilesRetry}
            />
            <KpiTile
              label={severalDays ? 'On leave' : tileToday ? 'On leave today' : 'On leave'}
              value={shown ? formatCount(shown.onLeave) : ''}
              note={
                shown && severalDays
                  ? `${formatPercent(shareOf(shown.onLeave, expected))} of person-days`
                  : shown && w
                    ? `${formatPercent(shareOf(shown.onLeave, w.headcount))} of headcount`
                    : undefined
              }
              icon={CalendarOff}
              link={access.timeSheet ? timeSheetLink(days, 'leave') : undefined}
              loading={tilesLoading}
              onRetry={tilesRetry}
            />
            <KpiTile
              label="Absenteeism"
              value={shown ? formatPercent(shareOf(shown.absent, expected)) : ''}
              note={
                shown
                  ? severalDays
                    ? `${plural(shown.absent, 'person-day', 'person-days')} absent`
                    : `${plural(shown.absent, 'person', 'people')} absent`
                  : undefined
              }
              icon={Percent}
              link={access.timeSheet ? timeSheetLink(days, 'absent') : undefined}
              loading={tilesLoading}
              onRetry={tilesRetry}
            />
            <KpiTile
              label="New hires"
              value={w ? formatCount(w.hired) : ''}
              note={w ? formatMonthYear(w.month) : undefined}
              delta={w ? deltaOf(w.hired, previous?.hired, previous?.month) : undefined}
              icon={UserPlus}
              link={access.employees ? { to: '/talent-management/employees' } : undefined}
              loading={loading}
            />
            <KpiTile
              label="Leavers"
              value={w ? formatCount(w.left) : ''}
              note={w ? `Turnover ${formatPercent(w.turnoverPercent)}` : undefined}
              delta={w ? deltaOf(w.left, previous?.left, previous?.month) : undefined}
              icon={UserMinus}
              link={
                access.employees
                  ? { to: '/talent-management/employees', search: { includeInactive: true } }
                  : undefined
              }
              loading={loading}
            />
          </>
        )}
        {access.openings && (
          <KpiTile
            label="Open positions"
            value={openings.data === undefined ? '' : formatCount(openings.data)}
            note="Open job openings"
            icon={BriefcaseBusiness}
            link={{ to: '/recruitment/openings', search: { status: 'open' } }}
            loading={openings.isPending}
            onRetry={
              openings.isError
                ? () => {
                    void openings.refetch()
                  }
                : undefined
            }
          />
        )}
        {personal && access.approvals && (
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

      <div
        aria-busy={dashboard.isPlaceholderData}
        className={cn(
          'grid gap-5 transition-opacity sm:gap-6',
          dashboard.isPlaceholderData && 'opacity-60',
        )}
      >
        <Section title="Attendance">
          <div className="grid gap-4 sm:gap-5 @3xl/page:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <AttendanceTodayWidget
              query={attendance}
              title={onToday ? 'Attendance today' : 'Attendance'}
              link={access.timeSheet ? timeSheetLink(day) : undefined}
            />
            <AttendanceByMonthWidget
              query={attendance}
              year={year}
              month={monthNo}
              // The API counts the months up to To.
              lastMonth={monthNo}
            />
          </div>
          <WhosInWidget
            query={attendance}
            day={onToday ? undefined : day}
            link={access.timeSheet ? timeSheetLink(day) : undefined}
          />
        </Section>

        <Section title="Workforce">
          <div className="grid gap-4 sm:gap-5 @2xl/page:grid-cols-2 @[68rem]/page:grid-cols-3">
            <DepartmentWidget
              query={workforce}
              link={access.employees ? { to: '/talent-management/employees' } : undefined}
            />
            <GenderAgeWidget query={workforce} />
            <TurnoverWidget query={workforce} />
            <EmploymentTypeWidget query={workforce} />
            <WomenByTitleWidget query={workforce} className="@2xl/page:col-span-2" />
          </div>
        </Section>
      </div>

      <ModuleCards period={period} access={access} personal={personal} />

      <Section title="Recent activity">
        <div className="grid gap-4 sm:gap-5 @2xl/page:grid-cols-2 @[96rem]/page:grid-cols-4">
          {personal && access.approvals && <WaitingWidget query={waiting} />}
          <LeaveApplicationsWidget
            query={view((data) => data.leaveApplications)}
            title="Leave applications"
            link={access.leaves ? { to: '/leaves/applications' } : undefined}
          />
          {personal && (
            <>
              <NoticeBoardWidget query={view(() => hr?.noticeBoard ?? [])} />
              <EventsWidget query={view(() => hr?.upcomingEvents ?? [])} />
            </>
          )}
        </div>
      </Section>
    </>
  )
}
