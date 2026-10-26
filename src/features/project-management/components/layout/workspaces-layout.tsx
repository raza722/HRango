import type { ReactNode } from 'react'

import type { WorkspaceSummary } from '../../types/pm.types'
import { CommentsProvider } from '../comments/comments-panel'
import { CreateWorkspaceWizard } from '../create-workspace/create-workspace-wizard'
import { WorkspacesPanel } from './workspaces-panel'

interface WorkspacesLayoutProps {
  /** The open workspace, highlighted in the panel. */
  workspaceId: string | null
  listId: string | null
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  onCreated: (workspace: WorkspaceSummary) => void
  children: ReactNode
}

/**
 * Project Management's working area: the Workspaces panel beside the page (Create Workspace
 * Page 388:137608 and Workspace Page 1:2755), and the Create Workspace wizard over both.
 */
export function WorkspacesLayout({
  workspaceId,
  listId,
  createOpen,
  onCreateOpenChange,
  onCreated,
  children,
}: WorkspacesLayoutProps) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 lg:flex-row lg:items-stretch">
      <WorkspacesPanel
        workspaceId={workspaceId}
        listId={listId}
        onCreate={() => {
          onCreateOpenChange(true)
        }}
      />
      <div className="min-w-0 flex-1">
        <CommentsProvider>{children}</CommentsProvider>
      </div>
      <CreateWorkspaceWizard
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        onCreated={onCreated}
      />
    </div>
  )
}
