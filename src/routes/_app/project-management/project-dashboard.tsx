import { createFileRoute } from '@tanstack/react-router'

import { projectDashboardSearchSchema } from '@/features/project-management/components/dashboards/dashboard-search'
import { ProjectDashboard } from '@/features/project-management/components/dashboards/project-dashboard'
import { pageTitle } from '@/lib/constants'

/** Project Management → Project Dashboard (`?workspace=&folder=`): a project is a folder. */
export const Route = createFileRoute('/_app/project-management/project-dashboard')({
  validateSearch: projectDashboardSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Project Dashboard') }] }),
  component: ProjectDashboardRoute,
})

function ProjectDashboardRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ProjectDashboard
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
