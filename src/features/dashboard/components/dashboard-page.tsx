import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'
import { useAuthStore } from '@/stores/auth-store'

import { dashboardKindFor } from '../api/dashboard.api'
import { useDashboardAccess } from '../hooks/use-dashboard-access'
import { dashboardPeriodFor, dashboardSearchFor } from '../routing'
import { DashboardHeader } from './dashboard-header'
import { ModuleCards } from './module-cards'
import { MyDashboardView } from './my-dashboard'
import { OrgDashboard } from './org-dashboard'
import { Widget } from './widget'

const routeApi = getRouteApi('/_app/')

/**
 * The landing page after sign-in: an overview of every module the user may see. Which dashboard
 * it is follows the user's permissions (`dashboardKindFor`: HR, else CEO, else their own); From and
 * To in the header (`?from=&to=`, this month up to today by default) set the dates the figures
 * cover, and the month of To the figures the API gives only per month. Each widget has its own loading,
 * empty and error states, and one the user may not read is left out. The layout uses the full
 * content width: columns follow the page container's width.
 */
export function DashboardPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const user = useAuthStore((state) => state.user)
  const access = useDashboardAccess()
  const kind = dashboardKindFor(user)
  const [now] = useState(() => new Date())
  // Days after today, or From after To (typed into the URL), fall back.
  const period = dashboardPeriodFor(search, now)

  return (
    <PageContainer>
      <DashboardHeader
        kind={kind}
        name={user?.name}
        now={now}
        period={period}
        access={access}
        onPeriodChange={(from, to) => {
          // A To before From moves From to the 1st of To's month; more than a year is cut.
          const next = dashboardPeriodFor({ from, to }, now)
          void navigate({ search: dashboardSearchFor(next.from, next.to, next.today) })
        }}
      />
      {kind === 'hr' || kind === 'ceo' ? (
        <OrgDashboard kind={kind} period={period} access={access} />
      ) : kind === 'me' ? (
        <MyDashboardView period={period} access={access} />
      ) : (
        <>
          <Widget title="No dashboard yet">
            <p className="text-sm text-muted-foreground">
              Your role has no dashboard. Ask your administrator for the HR, CEO or employee
              dashboard permission; the modules you can open are below and in the menu.
            </p>
          </Widget>
          <ModuleCards period={period} access={access} personal={false} />
        </>
      )}
    </PageContainer>
  )
}
