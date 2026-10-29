import type { ComponentType, SVGProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Briefcase, CalendarCheck2, ShieldAlert, Users, UserX } from 'lucide-react'

import { filterNavItems, type NavItem } from '@/app/navigation'
import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RC_CODES, recruitmentApi, recruitmentKeys } from '@/features/recruitment'
import {
  POLICY_NAME_LABELS,
  TIME_SPAN_TABLE_LABELS,
  warningPoliciesQueryOptions,
} from '@/features/warning'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { dashboardKindFor, dashboardSummaryQueryOptions } from '../api/dashboard.api'

type StatKey = 'headcount' | 'presentToday' | 'onLeave' | 'openPositions' | 'activeWarningPolicies'

interface StatDefinition {
  key: StatKey
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: string
  /** The list the tile opens. */
  to:
    | '/talent-management'
    | '/attendance/overview'
    | '/leaves/applications'
    | '/recruitment/openings'
    | '/warning/policy'
}

const STATS: readonly StatDefinition[] = [
  {
    key: 'headcount',
    label: 'Headcount',
    icon: Users,
    tone: 'bg-primary/12 text-primary',
    to: '/talent-management',
  },
  {
    key: 'presentToday',
    label: 'Present today',
    icon: CalendarCheck2,
    tone: 'bg-success/15 text-success',
    to: '/attendance/overview',
  },
  {
    key: 'onLeave',
    label: 'On leave',
    icon: UserX,
    tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    to: '/leaves/applications',
  },
  {
    key: 'openPositions',
    label: 'Open positions',
    icon: Briefcase,
    tone: 'bg-pager-active/12 text-pager-active',
    to: '/recruitment/openings',
  },
  {
    key: 'activeWarningPolicies',
    label: 'Active warning policies',
    icon: ShieldAlert,
    tone: 'bg-destructive/12 text-destructive',
    to: '/warning/policy',
  },
]

/** The open job openings (Recruitment → Job Openings), as one count. */
const OPEN_OPENINGS = { status: 'open', page: 1, pageSize: 1 } as const

/** Enough of the policy list to count the active ones (the API has no status filter). */
const POLICY_COUNT_PAGE = { page: 1, pageSize: 100 } as const

function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

interface DashboardPageProps {
  /** Modules to offer as shortcuts (the sidebar entries, minus the dashboard). */
  shortcuts?: readonly NavItem[]
}

/** Why a tile shows no figure. */
const EMPTY_TILE: Partial<Record<StatKey, string>> = {
  headcount: 'Not on your dashboard',
  openPositions: 'No access',
  activeWarningPolicies: 'No access',
}

/**
 * Landing page after sign-in. Headcount, present and on leave come from the dashboard the
 * user may see (`GET /dashboard/hr`, else `/ceo`, else `/me`); open positions from
 * Recruitment's open job openings; the active warning policies from the warning list. Each
 * tile with a figure opens its list. Figures the API does not provide show "—". It uses the
 * full content width: KPI columns and the side-by-side lower cards follow the page container's
 * width.
 */
export function DashboardPage({ shortcuts = [] }: DashboardPageProps) {
  const user = useAuthStore((state) => state.user)
  const kind = dashboardKindFor(user)
  const summary = useQuery({
    ...dashboardSummaryQueryOptions(kind ?? 'me'),
    enabled: kind !== null,
  })
  const canSeePolicies = useCan('warning.settings.policies.view')
  const policies = useQuery({
    ...warningPoliciesQueryOptions(POLICY_COUNT_PAGE),
    enabled: canSeePolicies,
  })
  const canSeeOpenings = useCan(RC_CODES.openingsView)
  const openings = useQuery({
    queryKey: recruitmentKeys.list('openings', OPEN_OPENINGS),
    queryFn: ({ signal }) => recruitmentApi.openings(OPEN_OPENINGS, signal),
    enabled: canSeeOpenings,
  })
  const modules = filterNavItems(shortcuts, user)
  const recentPolicies = policies.data?.data.slice(0, 5) ?? []

  const figures: Record<StatKey, number | null> = {
    headcount: summary.data?.headcount ?? null,
    presentToday: summary.data?.presentToday ?? null,
    onLeave: summary.data?.onLeave ?? null,
    openPositions: summary.data?.openPositions ?? openings.data?.meta.total ?? null,
    // Inactive policies are left out of the count.
    activeWarningPolicies: policies.data
      ? policies.data.data.filter((policy) => policy.isActive).length
      : null,
  }
  const loading: Record<StatKey, boolean> = {
    headcount: kind !== null && summary.isPending,
    presentToday: kind !== null && summary.isPending,
    onLeave: kind !== null && summary.isPending,
    openPositions: canSeeOpenings && openings.isPending,
    activeWarningPolicies: canSeePolicies && policies.isPending,
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={`${greeting()}${user ? `, ${user.name.split(' ')[0] ?? user.name}` : ''}. Here is today at a glance.`}
      />

      {summary.isError ? (
        <ErrorState
          message={summary.error.message}
          onRetry={() => {
            void summary.refetch()
          }}
        />
      ) : (
        // 2 columns on phones (the fifth tile spans both), 3 at 48rem, all 5 from 72rem.
        <ul
          aria-label="Key figures"
          className="grid grid-cols-2 gap-3 sm:gap-5 @3xl/page:grid-cols-3 @6xl/page:grid-cols-5 [&>li:last-child]:col-span-2 @3xl/page:[&>li:last-child]:col-span-1"
        >
          {STATS.map(({ key, label, icon: Icon, tone, to }) => {
            const figure = figures[key]
            const linked = !loading[key] && figure !== null
            const tile = (
              // Narrow tiles stack icon over figure; wide tiles put them side by side.
              <Card
                className={cn(
                  'flex h-full flex-col items-start gap-3 p-4 @[13rem]:flex-row @[13rem]:items-center @[13rem]:gap-4 @[13rem]:p-5',
                  linked && 'transition-colors group-hover:bg-accent',
                )}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full @[13rem]:size-12 ${tone}`}
                >
                  <Icon className="size-5 @[13rem]:size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-muted-foreground">{label}</span>
                  {loading[key] ? (
                    <Skeleton className="mt-1 h-7 w-16" />
                  ) : figure === null ? (
                    // Not provided for this user or not on the API yet: an empty state, not 0.
                    <span className="block">
                      <span aria-hidden="true" className="text-2xl font-medium text-heading">
                        —
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {kind === null && key !== 'activeWarningPolicies' && key !== 'openPositions'
                          ? 'No dashboard access'
                          : (EMPTY_TILE[key] ?? 'No data')}
                      </span>
                    </span>
                  ) : (
                    <span className="block text-2xl font-medium text-heading tabular-nums">
                      {figure.toLocaleString()}
                    </span>
                  )}
                </span>
              </Card>
            )
            return (
              <li key={key} className="@container min-w-0">
                {linked ? (
                  <Link
                    to={to}
                    aria-label={`${label}: ${figure.toLocaleString()}`}
                    className="group block h-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {tile}
                  </Link>
                ) : (
                  tile
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Stacked until the page is 64rem wide, then side by side. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-5 @5xl/page:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {canSeePolicies && (
          <Card aria-labelledby="recent-policies-title">
            <CardHeader>
              <CardTitle id="recent-policies-title" className="text-lg sm:text-xl">
                Warning policies
              </CardTitle>
              <Button variant="outline" asChild>
                <Link to="/warning/policy">
                  Manage <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {policies.isPending ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentPolicies.map((policy) => (
                    <li
                      key={policy.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                    >
                      <Link
                        to="/warning/policy/$policyId"
                        params={{ policyId: policy.id }}
                        className="min-w-0 font-medium break-words text-heading hover:underline"
                      >
                        {policy.title}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {POLICY_NAME_LABELS[policy.policyName]} ·{' '}
                        {TIME_SPAN_TABLE_LABELS[policy.timeSpan]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {modules.length > 0 && (
          <Card aria-labelledby="modules-title">
            <CardHeader>
              <CardTitle id="modules-title" className="text-lg sm:text-xl">
                Modules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3">
                {modules.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex h-full flex-col items-center gap-2 rounded-md border border-border px-3 py-4 text-center text-sm text-heading transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}
