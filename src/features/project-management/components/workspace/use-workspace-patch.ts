import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pmKeys } from '../../api/pm.api'
import { useUpdateWorkspace } from '../../hooks/use-pm'
import type { Workspace, WorkspacePatch, WorkspaceTree } from '../../types/pm.types'

/**
 * Saves a change to the open workspace (columns, cover, description, members, views), showing
 * it at once; a refused change reloads the workspace and the global toast explains why.
 */
export function useWorkspacePatch(workspace: Workspace) {
  const queryClient = useQueryClient()
  const update = useUpdateWorkspace()

  const save = async (patch: WorkspacePatch, success?: string): Promise<boolean> => {
    queryClient.setQueryData<WorkspaceTree>(pmKeys.tree(), (tree) =>
      tree
        ? {
            ...tree,
            workspaces: tree.workspaces.map((entry) =>
              entry.id === workspace.id
                ? { ...entry, ...patch, setup: { ...entry.setup, ...patch.setup } }
                : entry,
            ),
          }
        : tree,
    )
    try {
      await update.mutateAsync({ id: workspace.id, patch })
      if (success) toast.success(success)
      return true
    } catch {
      await queryClient.invalidateQueries({ queryKey: pmKeys.tree() })
      return false
    }
  }

  return { save, saving: update.isPending }
}
