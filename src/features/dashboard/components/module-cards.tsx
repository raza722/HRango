import type { ReactNode } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import type { LeaveApplicationCounts, LeaveStatus } from '@/features/leaves'
import { formatRs, PAYROLL_STATUS_META, StatusChip } from '@/features/payroll'

import {
  activeCyclesQueryOptions,
  benefitsSummaryQueryOptions,
  leaveCountsQueryOptions,
  monthPayrollsQueryOptions,
  payrollDashboardQueryOptions,
  pendingExitsQueryOptions,
  recruitmentDashboardQueryOptions,
  settlementsToSettleQueryOptions,
  waitingReviewsQueryOptions,
  warningPolicyCountQueryOptions,
} from '../api/module-queries'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
import {
  formatCount,
  formatDay,
  formatMonthYear,
  formatShortMonth,
  formatSpan,
  plural,
} from '../utils/format'
import { PartBar } from './charts'
import { Figure, type QueryState, Section, Widget, WidgetBody, WidgetLink } from './widget'

/*
 * One card per module, each from the module's own summary read (see module-queries.ts) and
 * shown only to someone who may read it. Every figure opens the module.
 */

/** A figure with its own read: a skeleton while loading, a retry when it failed. */
function QueryFigure({
  label,
  query,
  render = formatCount,
  note,
}: {
  label: string
  query: QueryState<number>
  render?: (value: number) => ReactNode
  note?: ReactNode
}) {
  if (query.isPending) {
    return (
      <div className="grid gap-1 rounded-lg bg-muted/60 px-3 py-2">
        <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
        <Skeleton className="h-6 w-10 bg-card" />
      </div>
    )
  }
  if (query.isError || query.data === undefined) {
    return (
      <div
        role="alert"
        className="grid justify-items-start gap-1 rounded-lg bg-destructive/5 px-3 py-2"
      >
        <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
        <span className="text-xs text-heading">Could not be loaded.</span>
        <button
          type="button"
          onClick={() => {
            void query.refetch()
          }}
          className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-[#c4b5fd]"
        >
          <RotateCw aria-hidden="true" className="size-3" /> Try again
        </button>
      </div>
    )
  }
  return <Figure label={label} value={render(query.data)} note={note} />
}

const figuresClass = 'grid grid-cols-2 gap-2'

/** One count of a status-count read, as a figure's state. */
function countOf(
  query: UseQueryResult<LeaveApplicationCounts>,
  status: LeaveStatus,
): QueryState<number> {
  return {
    data: query.data?.[status],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// --- Payroll --------------------------------------------------------------------------------------

/** This month's payroll: the run's status, net payable and payslips, against last month. */
export function PayrollCard({ month, access }: { month: string; access: DashboardAccess }) {
  const year = Number(month.slice(0, 4))
  const dashboard = useQuery(payrollDashboardQueryOptions(year))
  const runs = useQuery({ ...monthPayrollsQueryOptions(month), enabled: access.payrollRuns })
  const monthly = (runs.data?.data ?? []).filter((run) => run.kind === 'monthly')
  return (
    <Widget
      title="Payroll"
      description={formatMonthYear(month)}
      action={<WidgetLink link={{ to: '/payroll/dashboard' }} label="Open" name="Open Payroll" />}
    >
      <WidgetBody query={dashboard} what="Payroll" skeleton="figures">
        {(data) => {
          const stat = data.salaryStatistics.find((row) => row.month.startsWith(month))
          const index = data.salaryStatistics.findIndex((row) => row.month.startsWith(month))
          const previous = index > 0 ? data.salaryStatistics[index - 1] : undefined
          return (
            <div className="grid gap-3">
              {access.payrollRuns && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-field-foreground">
                  <span className="text-muted-foreground">Status</span>
                  {runs.isPending ? (
                    <Skeleton className="h-5 w-16" />
                  ) : runs.isError ? (
                    <span>Not loaded</span>
                  ) : monthly.length === 0 ? (
                    <span>No monthly payroll yet</span>
                  ) : (
                    monthly.slice(0, 2).map((run) => (
                      <span key={run.id} className="flex items-center gap-1.5">
                        <StatusChip {...PAYROLL_STATUS_META[run.status]} />
                        {monthly.length > 1 && <span className="truncate">{run.name}</span>}
                      </span>
                    ))
                  )}
                </div>
              )}
              <dl className={figuresClass}>
                <Figure
                  label="Net payable"
                  value={stat ? formatRs(stat.netPayable) : '—'}
                  note={
                    !stat
                      ? 'No payslips this month'
                      : previous
                        ? `${stat.netPayable >= previous.netPayable ? '+' : '−'}${formatRs(Math.abs(stat.netPayable - previous.netPayable))} vs ${formatShortMonth(previous.month)}`
                        : undefined
                  }
                />
                <Figure label="Payslips" value={formatCount(stat?.payslipCount ?? 0)} />
              </dl>
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

// --- Recruitment ----------------------------------------------------------------------------------

export function RecruitmentCard({ month }: { month: string }) {
  const year = Number(month.slice(0, 4))
  const monthNo = Number(month.slice(5, 7))
  const query = useQuery(recruitmentDashboardQueryOptions(year, monthNo))
  return (
    <Widget
      title="Recruitment"
      description={formatMonthYear(month)}
      action={
        <WidgetLink
          link={{ to: '/recruitment/dashboard', search: { year, month: monthNo } }}
          label="Open"
          name="Open Recruitment"
        />
      }
    >
      <WidgetBody query={query} what="Recruitment" skeleton="figures">
        {(data) => {
          const next = data.upcomingInterviews[0]
          return (
            <div className="grid gap-3">
              <dl className={figuresClass}>
                <Figure
                  label="Open openings"
                  value={formatCount(data.tiles.openOpenings)}
                  note={plural(data.tiles.openVacancies, 'vacancy', 'vacancies')}
                />
                <Figure
                  label="Upcoming interviews"
                  value={formatCount(data.tiles.upcomingInterviews)}
                />
                <Figure label="Offers accepted" value={formatCount(data.tiles.offersAccepted)} />
                <Figure label="Hired" value={formatCount(data.tiles.hired)} />
              </dl>
              {next && (
                <p className="truncate text-xs text-field-foreground">
                  <span className="text-muted-foreground">Next interview: </span>
                  {next.applicantName}, {next.jobOpeningTitle} · {formatDay(next.scheduledAt)}
                </p>
              )}
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

// --- Performance ----------------------------------------------------------------------------------

/** The running appraisal cycle's stage progress, and the reviews waiting for the caller. */
export function PerformanceCard({
  access,
  personal,
}: {
  access: DashboardAccess
  /** Show the caller's own waiting reviews (not on the CEO dashboard). */
  personal: boolean
}) {
  const cycles = useQuery(activeCyclesQueryOptions())
  const self = useQuery({
    ...waitingReviewsQueryOptions('self'),
    enabled: personal && access.selfReviews,
  })
  const team = useQuery({
    ...waitingReviewsQueryOptions('manager'),
    enabled: personal && access.managerReviews,
  })
  return (
    <Widget
      title="Performance"
      description="Current appraisal cycle"
      action={
        <WidgetLink
          link={{ to: '/performance/cycles' }}
          label="Open"
          name="Open the appraisal cycles"
        />
      }
    >
      <WidgetBody query={cycles} what="Appraisal cycles" skeleton="figures">
        {(page) => {
          const cycle = page.data[0]
          const started = cycle
            ? cycle.selfReview + cycle.managerReview + cycle.reviewed + cycle.finalised
            : 0
          return (
            <div className="grid gap-3">
              {cycle ? (
                <div className="grid gap-2">
                  <p className="text-sm">
                    <span className="font-medium text-heading">{cycle.name}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                      {formatSpan(cycle.startDate, cycle.endDate)}
                    </span>
                  </p>
                  <p className="text-xs text-field-foreground">
                    {formatCount(cycle.finalised)} of {plural(cycle.participants, 'appraisal')}{' '}
                    finalised
                  </p>
                  <PartBar
                    label={`Appraisal stages, ${cycle.name}`}
                    parts={[
                      {
                        key: 'draft',
                        label: 'Not started',
                        value: Math.max(0, cycle.participants - started),
                        tone: 'rest',
                      },
                      {
                        key: 'self',
                        label: 'Self review',
                        value: cycle.selfReview,
                        tone: 1,
                        stage: 0,
                      },
                      {
                        key: 'manager',
                        label: 'Manager review',
                        value: cycle.managerReview,
                        tone: 1,
                        stage: 1,
                      },
                      {
                        key: 'reviewed',
                        label: 'Reviewed',
                        value: cycle.reviewed,
                        tone: 1,
                        stage: 2,
                      },
                      {
                        key: 'final',
                        label: 'Finalised',
                        value: cycle.finalised,
                        tone: 1,
                        stage: 3,
                      },
                    ]}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No appraisal cycle is running.</p>
              )}
              {personal && (access.selfReviews || access.managerReviews) && (
                <dl className={figuresClass}>
                  {access.selfReviews && (
                    <QueryFigure label="Your self reviews" query={self} note="to write" />
                  )}
                  {access.managerReviews && (
                    <QueryFigure label="Team reviews waiting" query={team} />
                  )}
                </dl>
              )}
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

// --- Leaves ---------------------------------------------------------------------------------------

export function LeavesCard({ month, monthEnd }: { month: string; monthEnd: string }) {
  const all = useQuery(leaveCountsQueryOptions())
  const inMonth = useQuery(leaveCountsQueryOptions({ fromDate: `${month}-01`, toDate: monthEnd }))
  return (
    <Widget
      title="Leaves"
      description={formatMonthYear(month)}
      action={
        <WidgetLink
          link={{ to: '/leaves/applications', search: { status: 'pending' } }}
          label="Open"
          name="Open the pending leave applications"
        />
      }
    >
      <dl className={figuresClass}>
        <QueryFigure
          label="Pending"
          query={countOf(all, 'pending')}
          note="waiting for a decision"
        />
        <QueryFigure label="Approved" query={countOf(inMonth, 'approved')} note="in this month" />
        <QueryFigure label="Rejected" query={countOf(inMonth, 'rejected')} note="in this month" />
        <QueryFigure label="Cancelling" query={countOf(all, 'cancelling')} note="asked to cancel" />
      </dl>
    </Widget>
  )
}

// --- Separation -----------------------------------------------------------------------------------

export function SeparationCard({ access }: { access: DashboardAccess }) {
  const exits = useQuery({ ...pendingExitsQueryOptions(), enabled: access.exits })
  const settlements = useQuery({
    ...settlementsToSettleQueryOptions(),
    enabled: access.settlements,
  })
  return (
    <Widget
      title="Separation"
      description="Exits in progress"
      action={
        <WidgetLink
          link={{ to: '/separation-management' }}
          label="Open"
          name="Open Separation Management"
        />
      }
    >
      <dl className={figuresClass}>
        {access.exits && <QueryFigure label="End of employment" query={exits} note="pending" />}
        {access.settlements && (
          <QueryFigure label="Final settlements" query={settlements} note="to settle" />
        )}
      </dl>
    </Widget>
  )
}

// --- Benefits -------------------------------------------------------------------------------------

export function BenefitsCard() {
  const query = useQuery(benefitsSummaryQueryOptions())
  return (
    <Widget
      title="Benefits"
      action={<WidgetLink link={{ to: '/benefits' }} label="Open" name="Open Benefits" />}
    >
      <WidgetBody query={query} what="Benefits" skeleton="figures">
        {(data) => (
          <dl className={figuresClass}>
            <Figure label="Plans" value={formatCount(data.plans)} />
            <Figure label="Plan years" value={formatCount(data.planYears)} />
            <Figure label="Enrolment windows" value={formatCount(data.enrollmentWindows)} />
            <Figure label="Employees" value={formatCount(data.employees)} />
          </dl>
        )}
      </WidgetBody>
    </Widget>
  )
}

// --- Warning --------------------------------------------------------------------------------------

export function WarningCard() {
  const query = useQuery(warningPolicyCountQueryOptions())
  return (
    <Widget
      title="Warning policies"
      action={<WidgetLink link={{ to: '/warning' }} label="Open" name="Open Warning" />}
    >
      <WidgetBody query={query} what="Warning policies" skeleton="figures">
        {(page) => {
          const active = page.data.filter((policy) => policy.isActive).length
          return (
            <dl className={figuresClass}>
              <Figure label="Active" value={formatCount(active)} />
              <Figure label="Inactive" value={formatCount(page.meta.total - active)} />
            </dl>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

/** The module cards the user may see, in a grid that adds columns as the page widens. */
export function ModuleCards({
  month,
  monthEnd,
  access,
  personal,
}: {
  month: string
  monthEnd: string
  access: DashboardAccess
  personal: boolean
}) {
  const cards = [
    access.payroll && <PayrollCard key="payroll" month={month} access={access} />,
    access.recruitment && <RecruitmentCard key="recruitment" month={month} />,
    access.performance && <PerformanceCard key="performance" access={access} personal={personal} />,
    access.leaves && <LeavesCard key="leaves" month={month} monthEnd={monthEnd} />,
    (access.exits || access.settlements) && <SeparationCard key="separation" access={access} />,
    access.benefits && <BenefitsCard key="benefits" />,
    access.warning && <WarningCard key="warning" />,
  ].filter(Boolean)
  if (cards.length === 0) return null
  return (
    <Section title="Modules">
      <div className="grid grid-cols-1 gap-4 sm:gap-5 @2xl/page:grid-cols-2 @[68rem]/page:grid-cols-3 @[110rem]/page:grid-cols-4">
        {cards}
      </div>
    </Section>
  )
}
