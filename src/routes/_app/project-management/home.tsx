import { createFileRoute } from '@tanstack/react-router'

import { PmDashboardPlaceholder } from '@/features/project-management/components/layout/pm-dashboard-placeholder'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/project-management/home')({
  head: () => ({ meta: [{ title: pageTitle('Home Dashboard') }] }),
  component: () => <PmDashboardPlaceholder title="Home Dashboard" />,
})
