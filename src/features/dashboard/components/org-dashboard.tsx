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

export interface DashboardPeriod {
  /** `yyyy-MM` the monthly figures cover. */
  month: string
  /** Its last day, `yyyy-MM-dd`. */
  monthEnd: string
  currentMonth: string
  today: string
}

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
  const params = dashboardParamsFor(period.month === period.currentMonth ? undefined : period.month)
  const dashboard = useQuery({
    ...dashboardQueryOptions(kind, params),
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
  const day = a?.day ?? period.today
  const onToday = day === period.today
  const expected = a ? a.present + a.absent + a.onLeave : 0
  const topWaiting = waiting.data?.byType[0]
  const year = Number(period.month.slice(0, 4))
  const monthNo = Number(period.month.slice(5, 7))
  const lastMonth =
    period.month.slice(0, 4) < period.currentMonth.slice(0, 4)
      ? 12
      : Number(period.currentMonth.slice(5, 7))

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
              label={onToday ? 'Present today' : `Present on ${formatDay(day)}`}
              value={a ? formatCount(a.present) : ''}
              // Out of everyone expected at work, as the Attendance card and absenteeism count it
              // (not headcount: days off and shifts not yet started would pull the share down).
              note={
                a
                  ? expected > 0
                    ? `of ${formatCount(expected)} expected · ${formatPercent(shareOf(a.present, expected))}`
                    : 'Nobody expected yet'
                  : undefined
              }
              icon={UserCheck}
              link={access.timeSheet ? timeSheetLink(day) : undefined}
              loading={loading}
            />
            <KpiTile
              label={onToday ? 'On leave today' : 'On leave'}
              value={a ? formatCount(a.onLeave) : ''}
              note={
                a && w
                  ? `${formatPercent(shareOf(a.onLeave, w.headcount))} of headcount`
                  : undefined
              }
              icon={CalendarOff}
              link={access.timeSheet ? timeSheetLink(day, 'leave') : undefined}
              loading={loading}
            />
            <KpiTile
              label="Absenteeism"
              value={a ? formatPercent(a.absenteeismPercent) : ''}
              note={a ? `${plural(a.absent, 'person', 'people')} absent` : undefined}
              icon={Percent}
              link={access.timeSheet ? timeSheetLink(day, 'absent') : undefined}
              loading={loading}
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
              lastMonth={lastMonth}
            />
          </div>
          <WhosInWidget
            query={attendance}
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

      <ModuleCards
        month={period.month}
        monthEnd={period.monthEnd}
        access={access}
        personal={personal}
      />

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
