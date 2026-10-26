import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pmKeys } from '../../api/pm.api'
import { useUpdateWorkspace } from '../../hooks/use-pm'
import type { Workspace, WorkspacePatch } from '../../types/pm.types'

/**
 * Saves a change to the open workspace (name, description, favourite, members, columns, a view),
 * showing what it can at once; a refused change reloads the workspace and the global toast
 * explains why.
 */
export function useWorkspacePatch(workspace: Workspace) {
  const queryClient = useQueryClient()
  const update = useUpdateWorkspace()

  const save = async (patch: WorkspacePatch, success?: string): Promise<boolean> => {
    queryClient.setQueryData<Workspace>(pmKeys.workspace(workspace.id), (current) =>
      current
        ? {
            ...current,
            ...(patch.name === undefined ? {} : { name: patch.name }),
            ...(patch.description === undefined ? {} : { description: patch.description }),
            ...(patch.favorite === undefined ? {} : { favorite: patch.favorite }),
            ...(patch.columns ? { columns: patch.columns } : {}),
          }
        : current,
    )
    try {
      await update.mutateAsync({ workspace, patch })
      if (success) toast.success(success)
      return true
    } catch {
      await queryClient.invalidateQueries({ queryKey: pmKeys.workspace(workspace.id) })
      return false
    }
  }

  return { save, saving: update.isPending }
}
