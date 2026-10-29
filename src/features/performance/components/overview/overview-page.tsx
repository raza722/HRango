import type { ComponentType, SVGProps } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Gauge, ListChecks, Target } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { FormField } from '@/components/form'
import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeSearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  APPRAISAL_STATUS_META,
  GOAL_STATUS_META,
  labelOf,
  metaOf,
  OUTCOME_LABELS,
  PERF_CODES,
} from '../../constants'
import { useMyEmployeeId, usePerformanceOverview } from '../../hooks/use-performance'
import type { AppraisalSummary, Overview } from '../../types/performance.types'
import { formatDate, formatPeriod, formatScore } from '../../utils/format'
import { cardClass, linkClass } from '../../utils/styles'
import { StageSteps } from '../appraisals/appraisal-parts'
import {
  Chip,
  EmptyNote,
  Facts,
  GoalStatusChips,
  LoadingRows,
  PageHeaderCard,
  ProgressBar,
  SectionCard,
} from '../shared/parts'
import { BarChart, ColumnChart } from './overview-charts'

const routeApi = getRouteApi('/_app/performance/overview')

/** The rating scale the charts use (the API's summaries carry scores, not the scale). */
const SCALE_MAX = 5

interface Tile {
  label: string
  value: string
  hint: string
  colour: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** The goal counts as tiles, then the weighted progress as a bar. */
function GoalTiles({ overview }: { overview: Overview | undefined }) {
  const goals = overview?.goals
  const tiles: Tile[] = [
    {
      label: 'Total Goals',
      value: goals ? String(goals.total) : '—',
      hint: goals ? `${String(goals.cancelled)} cancelled` : '',
      colour: 'bg-[#3366FF]',
      icon: Target,
    },
    {
      label: 'Open Goals',
      value: goals ? String(goals.notStarted + goals.inProgress) : '—',
      hint: 'To check in on',
      colour: 'bg-[#17263A] dark:bg-[#4B5563]',
      icon: ListChecks,
    },
    {
      label: 'Completed',
      value: goals ? String(goals.completed) : '—',
      hint: 'Goals finished so far',
      colour: 'bg-[#0DCD94]',
      icon: CheckCircle2,
    },
    {
      label: 'Overdue',
      value: goals ? String(goals.overdue) : '—',
      hint: 'Past their due date',
      colour: 'bg-[#E4393C]',
      icon: AlertTriangle,
    },
  ]
  return (
    <ul
      aria-label="Goals in numbers"
      className="grid gap-4 sm:grid-cols-2 @[56rem]/page:grid-cols-5"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <li
            key={tile.label}
            className={cn(cardClass, 'flex h-20 items-center justify-between gap-3 px-4')}
          >
            <div className="grid gap-0.5">
              <span className="text-[0.625rem] font-medium text-title">{tile.label}</span>
              {overview ? (
                <span className="text-2xl leading-8 font-medium text-title">{tile.value}</span>
              ) : (
                <Skeleton className="h-7 w-12 bg-[#EEF1F7] dark:bg-muted" />
              )}
              <span className="text-[0.625rem] text-grey">{tile.hint}</span>
            </div>
            <span
              aria-hidden="true"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-[6px] text-white',
                tile.colour,
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} />
            </span>
          </li>
        )
      })}
      <li
        className={cn(
          cardClass,
          'grid h-20 content-center gap-1.5 px-4 sm:col-span-2 @[56rem]/page:col-span-1',
        )}
      >
        <span className="flex items-center justify-between gap-2 text-[0.625rem] font-medium text-title">
          Weighted Progress
          <Gauge aria-hidden="true" className="size-4 text-grey" />
        </span>
        {overview ? (
          <ProgressBar
            value={goals?.weightedProgress ?? null}
            label="Weighted progress of the goals"
          />
        ) : (
          <Skeleton className="h-3 w-full bg-[#EEF1F7] dark:bg-muted" />
        )}
        <span className="text-[0.625rem] text-grey">Progress by goal weight</span>
      </li>
    </ul>
  )
}

/** The appraisal of the running cycle (or the latest one): stages, due dates, a link. */
function CurrentAppraisal({
  appraisal,
  isMine,
}: {
  appraisal: AppraisalSummary | undefined
  isMine: boolean
}) {
  if (!appraisal) {
    return <EmptyNote>Not in a review cycle yet.</EmptyNote>
  }
  const writeSelf = isMine && appraisal.status === 'self_review'
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <span className="text-sm font-medium text-title">{appraisal.cycleName}</span>
          <span className="text-xs text-grey">
            {formatPeriod(appraisal.periodStart, appraisal.periodEnd)}
          </span>
        </span>
        <Chip meta={metaOf(APPRAISAL_STATUS_META, appraisal.status)} />
      </div>
      <StageSteps status={appraisal.status} hasSelfReview={appraisal.selfReviewDueDate !== null} />
      <Facts
        items={[
          { label: 'Self Review Due', value: formatDate(appraisal.selfReviewDueDate) },
          { label: 'Manager Review Due', value: formatDate(appraisal.managerReviewDueDate) },
          {
            label: 'Final Rating',
            value:
              appraisal.finalScore === null
                ? 'Not finalised'
                : `${formatScore(appraisal.finalScore)} · ${appraisal.finalRatingLabel ?? ''}`,
          },
        ]}
      />
      {writeSelf ? (
        <Link to="/performance/reviews" search={{ review: appraisal.id }} className={linkClass}>
          Write your self review
        </Link>
      ) : (
        <Link
          to="/performance/appraisals"
          search={{ appraisal: appraisal.id }}
          className={linkClass}
        >
          Open the appraisal
        </Link>
      )}
    </div>
  )
}

/** The open goals nearest their due date, with progress. */
function UpcomingGoals({ overview, isMine }: { overview: Overview; isMine: boolean }) {
  if (overview.upcomingGoals.length === 0) {
    return <EmptyNote>No open goals.</EmptyNote>
  }
  return (
    <ul aria-label="Upcoming goals" className="grid gap-2">
      {overview.upcomingGoals.map((goal) => (
        <li
          key={goal.id}
          className="grid gap-2 rounded-lg border border-[#E6E9F0] px-3 py-2.5 dark:border-border"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              to="/performance/goals"
              search={{ tab: isMine ? 'my' : 'all', goal: goal.id }}
              className="min-w-0 text-sm font-medium text-title outline-none hover:underline focus-visible:underline"
            >
              {goal.title}
            </Link>
            <GoalStatusChips status={goal.status} isOverdue={goal.isOverdue} />
          </div>
          <div className="grid gap-2 @md:grid-cols-[minmax(0,1fr)_auto] @md:items-center">
            <ProgressBar value={goal.progress} label={`Progress of ${goal.title}`} />
            <span className="text-[0.6875rem] text-grey">Due {formatDate(goal.dueDate)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Performance Overview (`GET /performance/overview?employeeId`): the caller's goals in numbers,
 * the weighted progress, goals by status, the open goals due next, the current appraisal and
 * the final rating of each cycle. Managers and HR can pick another person (`?employeeId=`).
 */
export function OverviewPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const myId = useMyEmployeeId()
  const canOthers = useCan(PERF_CODES.overviewOthers)
  const query = usePerformanceOverview(search.employeeId)
  const overview = query.data
  const isMine = !search.employeeId || search.employeeId === myId

  const current =
    overview?.appraisals.find((item) => item.status !== 'finalised' && item.status !== 'draft') ??
    overview?.appraisals[0]
  const rated = [...(overview?.appraisals ?? [])]
    .filter((item) => item.finalScore !== null)
    .reverse()
  const goals = overview?.goals

  return (
    <PageContainer>
      <PageHeaderCard
        title="Performance Overview"
        description={
          overview
            ? [
                overview.employeeName,
                overview.employeeCode,
                overview.jobTitleName,
                overview.departmentName,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Goals, check-ins and appraisals at a glance.'
        }
        actions={
          canOthers && (
            <FormField label="View for" className="w-full min-w-56 sm:w-64">
              {(a11y) => (
                <EmployeeSearchSelect
                  {...a11y}
                  value={search.employeeId ?? myId}
                  onChange={(next) => {
                    void navigate({
                      search: { employeeId: next && next !== myId ? next : undefined },
                    })
                  }}
                  filters={{ permission: PERF_CODES.overviewOthers }}
                  known={
                    overview
                      ? [{ value: overview.employeeId, label: overview.employeeName }]
                      : undefined
                  }
                  placeholder="Select Employee"
                />
              )}
            </FormField>
          )
        }
      />

      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : (
        <>
          <GoalTiles overview={overview} />
          <div className="grid items-start gap-4 sm:gap-5 @[56rem]/page:grid-cols-2">
            <SectionCard title="Current Appraisal" className={cn(cardClass, 'border-0 p-5')}>
              {overview ? (
                <CurrentAppraisal appraisal={current} isMine={isMine} />
              ) : (
                <LoadingRows label="the appraisal" />
              )}
            </SectionCard>
            <SectionCard title="Goals by Status" className={cn(cardClass, 'border-0 p-5')}>
              {!goals ? (
                <LoadingRows label="the goals" />
              ) : goals.total === 0 ? (
                <EmptyNote>No goals yet.</EmptyNote>
              ) : (
                <BarChart
                  title="Goals by status"
                  heading="Status"
                  valueHeading="Goals"
                  data={[
                    { label: GOAL_STATUS_META.not_started.label, value: goals.notStarted },
                    { label: GOAL_STATUS_META.in_progress.label, value: goals.inProgress },
                    { label: GOAL_STATUS_META.completed.label, value: goals.completed },
                    { label: GOAL_STATUS_META.cancelled.label, value: goals.cancelled },
                    { label: 'Overdue', value: goals.overdue },
                  ]}
                />
              )}
            </SectionCard>
            <SectionCard
              title="Upcoming Goals"
              className={cn(cardClass, 'border-0 p-5')}
              actions={
                <Link
                  to="/performance/goals"
                  search={isMine ? { tab: 'my' } : { tab: 'all', employeeId: search.employeeId }}
                  className={linkClass}
                >
                  All goals
                </Link>
              }
            >
              {overview ? (
                <UpcomingGoals overview={overview} isMine={isMine} />
              ) : (
                <LoadingRows label="the goals" />
              )}
            </SectionCard>
            <SectionCard title="Ratings by Cycle" className={cn(cardClass, 'border-0 p-5')}>
              {!overview ? (
                <LoadingRows label="the ratings" />
              ) : rated.length === 0 ? (
                <EmptyNote>No finalised appraisals yet.</EmptyNote>
              ) : (
                <div className="grid gap-3">
                  <ColumnChart
                    title="Final rating by cycle"
                    heading="Review Cycle"
                    valueHeading="Final Score"
                    max={SCALE_MAX}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    data={rated.map((item) => ({
                      label: item.cycleName,
                      value: item.finalScore ?? 0,
                      text: formatScore(item.finalScore),
                    }))}
                  />
                  <ul aria-label="Finalised appraisals" className="grid gap-1 text-xs text-title">
                    {[...rated].reverse().map((item) => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2">
                        <span>{item.cycleName}</span>
                        <span className="text-grey">
                          {formatScore(item.finalScore)} · {item.finalRatingLabel} ·{' '}
                          {labelOf(OUTCOME_LABELS, item.outcome) || 'No Change'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </PageContainer>
  )
}
