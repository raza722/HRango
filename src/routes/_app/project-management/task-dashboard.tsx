import { createFileRoute } from '@tanstack/react-router'

import { taskDashboardSearchSchema } from '@/features/project-management/components/dashboards/dashboard-search'
import { TaskDashboard } from '@/features/project-management/components/dashboards/task-dashboard'
import { pageTitle } from '@/lib/constants'

/** Project Management → Task Dashboard (`?workspace=&show=`): tasks over every workspace or one. */
export const Route = createFileRoute('/_app/project-management/task-dashboard')({
  validateSearch: taskDashboardSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Task Dashboard') }] }),
  component: TaskDashboardRoute,
})

function TaskDashboardRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TaskDashboard
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
