import type { ComponentType, SVGProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Briefcase, CalendarCheck2, ShieldAlert, Users, UserX } from 'lucide-react'

import type { NavItem } from '@/app/navigation'
import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { POLICY_NAME_LABELS, TIME_SPAN_TABLE_LABELS, useWarningPolicies } from '@/features/warning'
import { useAuthStore } from '@/stores/auth-store'

import { type DashboardSummary, dashboardSummaryQueryOptions } from '../api/dashboard.api'

interface StatDefinition {
  key: keyof DashboardSummary
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: string
}

const STATS: readonly StatDefinition[] = [
  { key: 'headcount', label: 'Headcount', icon: Users, tone: 'bg-primary/12 text-primary' },
  {
    key: 'presentToday',
    label: 'Present today',
    icon: CalendarCheck2,
    tone: 'bg-success/15 text-success',
  },
  {
    key: 'onLeave',
    label: 'On leave',
    icon: UserX,
    tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  {
    key: 'openPositions',
    label: 'Open positions',
    icon: Briefcase,
    tone: 'bg-pager-active/12 text-pager-active',
  },
  {
    key: 'activeWarningPolicies',
    label: 'Warning policies',
    icon: ShieldAlert,
    tone: 'bg-destructive/12 text-destructive',
  },
]

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

/**
 * Landing page after sign-in. KPIs come from the mock API. It uses the full
 * content width: KPI columns and the side-by-side lower cards follow the
 * page container's width, not the window's.
 */
export function DashboardPage({ shortcuts = [] }: DashboardPageProps) {
  const user = useAuthStore((state) => state.user)
  const summary = useQuery(dashboardSummaryQueryOptions())
  const recentPolicies = useWarningPolicies({ page: 1, pageSize: 5 })

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
          {STATS.map(({ key, label, icon: Icon, tone }) => (
            <li key={key} className="@container min-w-0">
              {/* Narrow tiles stack icon over figure; wide tiles put them side by side. */}
              <Card className="flex h-full flex-col items-start gap-3 p-4 @[13rem]:flex-row @[13rem]:items-center @[13rem]:gap-4 @[13rem]:p-5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full @[13rem]:size-12 ${tone}`}
                >
                  <Icon className="size-5 @[13rem]:size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-muted-foreground">{label}</span>
                  {summary.data ? (
                    <span className="block text-2xl font-medium text-heading tabular-nums">
                      {summary.data[key].toLocaleString()}
                    </span>
                  ) : (
                    <Skeleton className="mt-1 h-7 w-16" />
                  )}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Stacked until the page is 64rem wide, then side by side. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-5 @5xl/page:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
            {recentPolicies.isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(recentPolicies.data?.data ?? []).map((policy) => (
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

        {shortcuts.length > 0 && (
          <Card aria-labelledby="modules-title">
            <CardHeader>
              <CardTitle id="modules-title" className="text-lg sm:text-xl">
                Modules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3">
                {shortcuts.map(({ to, label, icon: Icon }) => (
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
