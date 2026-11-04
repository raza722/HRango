import { createFileRoute } from '@tanstack/react-router'

import { PlatformDashboardPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/')({
  head: () => ({ meta: [{ title: pageTitle('Dashboard') }] }),
  component: PlatformDashboardPage,
})
