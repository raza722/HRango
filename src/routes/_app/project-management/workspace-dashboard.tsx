import { createFileRoute } from '@tanstack/react-router'

import { workspaceDashboardSearchSchema } from '@/features/project-management/components/dashboards/dashboard-search'
import { WorkspaceDashboard } from '@/features/project-management/components/dashboards/workspace-dashboard'
import { pageTitle } from '@/lib/constants'

/** Project Management → Workspace Dashboard (`?workspace=`): one workspace at a glance. */
export const Route = createFileRoute('/_app/project-management/workspace-dashboard')({
  validateSearch: workspaceDashboardSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Workspace Dashboard') }] }),
  component: WorkspaceDashboardRoute,
})

function WorkspaceDashboardRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WorkspaceDashboard
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
