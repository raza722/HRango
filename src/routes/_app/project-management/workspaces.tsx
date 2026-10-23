import { createFileRoute, Outlet, useMatch, useNavigate } from '@tanstack/react-router'

import { WorkspacesLayout } from '@/features/project-management/components/layout/workspaces-layout'
import { workspacesSearchSchema } from '@/features/project-management/pm-search'

/** The Workspaces panel and the Create Workspace wizard, around the workspace pages. */
export const Route = createFileRoute('/_app/project-management/workspaces')({
  validateSearch: workspacesSearchSchema,
  component: WorkspacesRoute,
})

function WorkspacesRoute() {
  const { create } = Route.useSearch()
  const navigate = useNavigate()
  const workspace = useMatch({
    from: '/_app/project-management/workspaces/$workspaceId',
    shouldThrow: false,
  })
  return (
    <WorkspacesLayout
      workspaceId={workspace?.params.workspaceId ?? null}
      listId={workspace?.search.list ?? null}
      createOpen={create === true}
      onCreateOpenChange={(open) => {
        void navigate({
          to: '.',
          search: (prev) => ({ ...prev, create: open ? true : undefined }),
        })
      }}
      onCreated={(created) => {
        void navigate({
          to: '/project-management/workspaces/$workspaceId',
          params: { workspaceId: created.id },
        })
      }}
    >
      <Outlet />
    </WorkspacesLayout>
  )
}
