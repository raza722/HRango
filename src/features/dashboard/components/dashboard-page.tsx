import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { endOfMonth, format, parse } from 'date-fns'

import { PageContainer } from '@/components/layout'
import { useAuthStore } from '@/stores/auth-store'

import { dashboardKindFor } from '../api/dashboard.api'
import { useDashboardAccess } from '../hooks/use-dashboard-access'
import { DashboardHeader } from './dashboard-header'
import { ModuleCards } from './module-cards'
import { MyDashboardView } from './my-dashboard'
import { type DashboardPeriod, OrgDashboard } from './org-dashboard'
import { Widget } from './widget'

const routeApi = getRouteApi('/_app/')

/**
 * The landing page after sign-in: an overview of every module the user may see. Which dashboard
 * it is follows the user's permissions (`dashboardKindFor`: HR, else CEO, else their own); the
 * month in the header (`?month=`) sets the monthly figures. Each widget has its own loading,
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
  const currentMonth = format(now, 'yyyy-MM')
  // A month after this one (typed into the URL) falls back to this one.
  const month = search.month && search.month < currentMonth ? search.month : currentMonth
  const period: DashboardPeriod = {
    month,
    monthEnd: format(endOfMonth(parse(month, 'yyyy-MM', now)), 'yyyy-MM-dd'),
    currentMonth,
    today: format(now, 'yyyy-MM-dd'),
  }

  return (
    <PageContainer>
      <DashboardHeader
        kind={kind}
        name={user?.name}
        now={now}
        month={month}
        currentMonth={currentMonth}
        access={access}
        onMonthChange={(next) => {
          void navigate({
            search: (current) => ({
              ...current,
              month: next >= currentMonth ? undefined : next,
            }),
          })
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
          <ModuleCards month={month} monthEnd={period.monthEnd} access={access} personal={false} />
        </>
      )}
    </PageContainer>
  )
}
