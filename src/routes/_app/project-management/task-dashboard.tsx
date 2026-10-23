import { createFileRoute } from '@tanstack/react-router'

import { PmDashboardPlaceholder } from '@/features/project-management/components/layout/pm-dashboard-placeholder'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/project-management/task-dashboard')({
  head: () => ({ meta: [{ title: pageTitle('Task Dashboard') }] }),
  component: () => <PmDashboardPlaceholder title="Task Dashboard" />,
})
