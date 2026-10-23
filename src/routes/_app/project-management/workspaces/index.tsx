import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { CreateWorkspaceLanding } from '@/features/project-management/components/layout/create-workspace-landing'
import { pageTitle } from '@/lib/constants'

/** Create Workspace Page (388:137608): the call to action beside the Workspaces panel. */
export const Route = createFileRoute('/_app/project-management/workspaces/')({
  head: () => ({ meta: [{ title: pageTitle('Create Workspace') }] }),
  component: CreateWorkspaceRoute,
})

function CreateWorkspaceRoute() {
  const navigate = useNavigate()
  return (
    <CreateWorkspaceLanding
      onCreate={() => {
        void navigate({ to: '/project-management/workspaces', search: { create: true } })
      }}
    />
  )
}
