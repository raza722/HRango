import { type ReactNode, useId, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  BriefcaseBusiness,
  CalendarCheck,
  FileUser,
  Handshake,
  type LucideIcon,
  Mail,
  Phone,
  UserCheck,
  UserX,
} from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer } from '@/components/layout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { btn, StatusChip, toolbarButton } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { INTERVIEW_MODE_LABELS, RC_CODES, STAGE_META } from '../../constants'
import {
  useApplications,
  useRecruitmentDashboard,
  useStageCounts,
} from '../../hooks/use-recruitment'
import type { DashboardSearch } from '../../routing'
import { STAGES } from '../../types/recruitment.types'
import { formatDay, formatRelative, formatStamp, labelOf } from '../../utils/format'
import { CandidateCell } from '../shared/fields'
import { EmptyNote } from '../shared/list-parts'
import { GroupedColumnChart, HorizontalBars } from './charts'

const routeApi = getRouteApi('/_app/recruitment/dashboard')

const MONTHS = Array.from({ length: 12 }, (_, index) => format(new Date(2024, index, 1), 'MMM'))
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2024, index, 1), 'MMMM'),
)
const ALL = 'all'

/** One white dashboard card with its title (and a control on its right). */
function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        '@container grid min-w-0 content-start gap-4 rounded-xl bg-card p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-medium text-title">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  note,
  tone,
  loading,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  note?: string | undefined
  tone: string
  loading: boolean
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl bg-card p-4 shadow-xs">
      <span
        aria-hidden="true"
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <span className="text-2xl font-semibold text-heading tabular-nums">{value ?? 0}</span>
        )}
        {note && !loading && <span className="truncate text-xs text-field-foreground">{note}</span>}
      </span>
    </li>
  )
}

/** First and last day of the chosen year or month (`yyyy-MM-dd`). */
function periodOf(year: number, month: number | undefined) {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1)
  const end = month ? new Date(year, month, 0) : new Date(year, 11, 31)
  return { fromDate: format(start, 'yyyy-MM-dd'), toDate: format(end, 'yyyy-MM-dd') }
}

/**
 * Recruitment Dashboard (`GET /recruitment/dashboard?year&month`): the tiles (openings,
 * applications, interviews, offers accepted, hired, rejected), Job Statistics per month,
 * the pipeline by stage for the period, upcoming interviews, recent applications and the latest
 * stage changes. Year and month are in the URL.
 */
export function RecruitmentDashboardPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(RC_CODES.openingsCreate)
  const [thisYear] = useState(() => new Date().getFullYear())
  const dashboard = useRecruitmentDashboard({ year: search.year, month: search.month })
  const period = periodOf(search.year, search.month)
  const counts = useStageCounts(period)
  const recent = useApplications({ ...period, page: 1, pageSize: 5 })
  const data = dashboard.data
  const loading = dashboard.isPending
  const update = (patch: Partial<DashboardSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const years = Array.from({ length: 6 }, (_, index) => thisYear - 4 + index)
  if (!years.includes(search.year)) years.unshift(search.year)
  const periodName = search.month
    ? `${MONTH_NAMES[search.month - 1] ?? ''} ${String(search.year)}`
    : String(search.year)
  const tiles = data?.tiles

  return (
    <PageContainer>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 shadow-xs sm:px-6">
        <h1 className="text-xl font-medium text-title sm:text-2xl">Recruitment Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={String(search.year)}
            onValueChange={(value) => {
              update({ year: Number(value) })
            }}
          >
            <SelectTrigger aria-label="Year" className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.month ? String(search.month) : ALL}
            onValueChange={(value) => {
              update({ month: value === ALL ? undefined : Number(value) })
            }}
          >
            <SelectTrigger aria-label="Month" className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All months</SelectItem>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Link
              to="/recruitment/openings"
              search={{ dialog: 'create' }}
              className={cn(toolbarButton, btn.navy, 'inline-flex items-center')}
            >
              + New Opening
            </Link>
          )}
        </div>
      </header>

      {dashboard.isError ? (
        <ErrorState
          title="Could not load the dashboard"
          message={dashboard.error.message}
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <>
          <ul
            aria-label="Recruitment in numbers"
            className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @3xl/page:grid-cols-3 @[90rem]/page:grid-cols-6"
          >
            <Tile
              icon={BriefcaseBusiness}
              label="Total Openings"
              value={tiles?.totalOpenings}
              note={
                tiles
                  ? `${String(tiles.openOpenings)} open now · ${String(tiles.openVacancies)} ${tiles.openVacancies === 1 ? 'vacancy' : 'vacancies'}`
                  : undefined
              }
              tone="bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300"
              loading={loading}
            />
            <Tile
              icon={FileUser}
              label="Applications"
              value={tiles?.applications}
              note={periodName}
              tone="bg-[#EFEAFF] text-[#5B3FD9] dark:bg-violet-500/15 dark:text-violet-300"
              loading={loading}
            />
            <Tile
              icon={CalendarCheck}
              label="Interviews"
              value={tiles?.interviews}
              note={tiles ? `${String(tiles.upcomingInterviews)} upcoming from today` : undefined}
              tone="bg-[#FFEDE0] text-[#C2560C] dark:bg-orange-500/15 dark:text-orange-300"
              loading={loading}
            />
            <Tile
              icon={Handshake}
              label="Offers Accepted"
              value={tiles?.offersAccepted}
              note={periodName}
              tone="bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300"
              loading={loading}
            />
            <Tile
              icon={UserCheck}
              label="Hired"
              value={tiles?.hired}
              note={periodName}
              tone="bg-[#E3F8E8] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400"
              loading={loading}
            />
            <Tile
              icon={UserX}
              label="Rejected"
              value={tiles?.rejected}
              note={periodName}
              tone="bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300"
              loading={loading}
            />
          </ul>

          <div className="grid gap-4 sm:gap-5 @5xl/page:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={`Job Statistics ${String(search.year)}`}>
              {loading ? (
                <Skeleton className="h-60 w-full" />
              ) : (
                <GroupedColumnChart
                  title={`Job statistics ${String(search.year)}`}
                  labels={MONTHS}
                  highlight={search.month ? search.month - 1 : undefined}
                  series={[
                    {
                      key: 'applications',
                      label: 'Applications',
                      values: (data?.jobStatistics ?? []).map((row) => row.applications),
                    },
                    {
                      key: 'shortlisted',
                      label: 'Shortlisted',
                      values: (data?.jobStatistics ?? []).map((row) => row.shortlisted),
                    },
                    {
                      key: 'hired',
                      label: 'Hired',
                      values: (data?.jobStatistics ?? []).map((row) => row.hired),
                    },
                    {
                      key: 'rejected',
                      label: 'Rejected',
                      values: (data?.jobStatistics ?? []).map((row) => row.rejected),
                    },
                  ]}
                />
              )}
            </Panel>
            <Panel
              title="Pipeline by Stage"
              action={
                <span className="text-xs text-muted-foreground">Applied in {periodName}</span>
              }
            >
              {counts.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not count the applications.
                </p>
              ) : (
                <HorizontalBars
                  label="Applications by stage"
                  loading={counts.isPending}
                  rows={STAGES.map((stage) => ({
                    key: stage,
                    label: STAGE_META[stage].label,
                    value: counts.data?.[stage] ?? 0,
                  }))}
                />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 sm:gap-5 @5xl/page:grid-cols-3">
            <Panel
              title="Upcoming Interviews (from today)"
              action={
                <Link
                  to="/recruitment/interviews"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  All interviews
                </Link>
              }
            >
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : (data?.upcomingInterviews ?? []).length === 0 ? (
                <EmptyNote>No interviews coming up.</EmptyNote>
              ) : (
                <ul aria-label="Upcoming interviews" className="grid gap-3">
                  {(data?.upcomingInterviews ?? []).map((row) => (
                    <li
                      key={row.interviewId}
                      className="grid gap-1.5 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <Link
                          to="/recruitment/interviews"
                          search={{ view: row.interviewId }}
                          className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <CandidateCell name={row.applicantName} detail={row.jobOpeningTitle} />
                        </Link>
                        <span className="flex shrink-0 gap-1">
                          <a
                            href={`mailto:${row.applicantEmail}`}
                            aria-label={`Email ${row.applicantName}`}
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-heading"
                          >
                            <Mail aria-hidden="true" className="size-4" />
                          </a>
                          {row.applicantPhone && (
                            <a
                              href={`tel:${row.applicantPhone}`}
                              aria-label={`Call ${row.applicantName}`}
                              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-heading"
                            >
                              <Phone aria-hidden="true" className="size-4" />
                            </a>
                          )}
                        </span>
                      </span>
                      <span className="text-xs text-field-foreground">
                        {formatStamp(row.scheduledAt)} · {labelOf(INTERVIEW_MODE_LABELS, row.mode)}{' '}
                        · round {row.roundNo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.firstInterviewerName
                          ? `With ${row.interviewerNames ?? row.firstInterviewerName}`
                          : 'No interviewer yet'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Recent Applications"
              action={
                <Link
                  to="/recruitment/applications"
                  search={{ mode: 'list' }}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  All applications
                </Link>
              }
            >
              {recent.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : recent.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load the applications.
                </p>
              ) : recent.data.data.length === 0 ? (
                <EmptyNote>No applications in {periodName}.</EmptyNote>
              ) : (
                <ul aria-label="Recent applications" className="grid gap-3">
                  {recent.data.data.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <Link
                        to="/recruitment/applications"
                        search={{ view: row.id }}
                        className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <CandidateCell
                          name={row.applicantName}
                          detail={`${row.jobOpeningTitle} · ${formatDay(row.appliedOn)}`}
                        />
                      </Link>
                      <StatusChip {...STAGE_META[row.stage]} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent Activity (latest)">
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : (data?.recentActivity ?? []).length === 0 ? (
                <EmptyNote>Nothing has moved yet.</EmptyNote>
              ) : (
                <ol aria-label="Recent activity" className="grid gap-3">
                  {(data?.recentActivity ?? []).map((row) => (
                    <li key={row.id} className="grid gap-0.5 border-b pb-3 last:border-0 last:pb-0">
                      <span className="text-sm text-heading">
                        <Link
                          to="/recruitment/applications"
                          search={{ view: row.applicationId }}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {row.applicantName}
                        </Link>{' '}
                        {row.fromStage || row.toStage !== 'applied' ? (
                          <>
                            {row.fromStage ? 'moved to' : 'was added at'}{' '}
                            <span className="font-medium">{STAGE_META[row.toStage].label}</span>
                          </>
                        ) : (
                          'applied'
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.jobOpeningTitle} · {formatRelative(row.changedAt)}
                        {row.changedByName ? ` · ${row.changedByName}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  )
}
