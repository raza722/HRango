import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { WorkspacesHome } from '@/features/project-management/components/layout/workspaces-home'
import { pageTitle } from '@/lib/constants'

/**
 * Workspaces: the workspaces the person can open beside the Workspaces panel, or the Create
 * Workspace page (388:137608) while there are none.
 */
export const Route = createFileRoute('/_app/project-management/workspaces/')({
  head: () => ({ meta: [{ title: pageTitle('Workspaces') }] }),
  component: WorkspacesRoute,
})

function WorkspacesRoute() {
  const navigate = useNavigate()
  return (
    <WorkspacesHome
      onCreate={() => {
        void navigate({ to: '/project-management/workspaces', search: { create: true } })
      }}
    />
  )
}
