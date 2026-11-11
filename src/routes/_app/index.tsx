import { createFileRoute } from '@tanstack/react-router'

import {
  dashboardKindFor,
  DashboardPage,
  dashboardParamsFor,
  dashboardPeriodFor,
  dashboardQueryOptions,
  dashboardSearchSchema,
} from '@/features/dashboard'
import { pageTitle } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_app/')({
  validateSearch: dashboardSearchSchema,
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to, month: search.month }),
  // Start fetching the user's dashboard during navigation, but render the page right away.
  loader: ({ context: { queryClient }, deps }) => {
    const kind = dashboardKindFor(useAuthStore.getState().user)
    if (kind) {
      queryClient
        .query(dashboardQueryOptions(kind, dashboardParamsFor(dashboardPeriodFor(deps))))
        .catch(() => undefined)
    }
  },
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  component: DashboardPage,
})
