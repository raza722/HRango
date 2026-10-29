import { createFileRoute } from '@tanstack/react-router'

import { WorkspacePage } from '@/features/project-management/components/workspace/workspace-page'
import { workspaceSearchSchema } from '@/features/project-management/pm-search'
import { pageTitle } from '@/lib/constants'

/** One workspace: its banner, view bar and List view (Workspace Page 1:2755). */
export const Route = createFileRoute('/_app/project-management/workspaces/$workspaceId')({
  validateSearch: workspaceSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Workspace') }] }),
  component: WorkspaceRoute,
})

function WorkspaceRoute() {
  const { workspaceId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WorkspacePage
      // A fresh page (selection, open menus) for each workspace.
      key={workspaceId}
      workspaceId={workspaceId}
      search={search}
      onSearch={(patch, options) => {
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          ...(options?.hash ? { hash: options.hash } : {}),
        })
      }}
    />
  )
}
