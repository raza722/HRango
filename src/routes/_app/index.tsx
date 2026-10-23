import { createFileRoute } from '@tanstack/react-router'

import { NAV_ITEMS } from '@/app/navigation'
import { DashboardPage, dashboardSummaryQueryOptions } from '@/features/dashboard'
import { pageTitle } from '@/lib/constants'

const shortcuts = NAV_ITEMS.filter((item) => item.to !== '/')

export const Route = createFileRoute('/_app/')({
  // Start fetching during navigation, but render the page right away.
  loader: ({ context: { queryClient } }) => {
    queryClient.query(dashboardSummaryQueryOptions()).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  component: () => <DashboardPage shortcuts={shortcuts} />,
})
