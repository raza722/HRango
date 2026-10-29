import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pmKeys } from '../../api/pm.api'
import { useUpdateWorkspace } from '../../hooks/use-pm'
import type { ListColumn, Workspace, WorkspacePatch } from '../../types/pm.types'

/**
 * Column saves of each workspace still to send: one runs at a time, and the newest list waits
 * for it (a column list is whole, so older waiting ones are dropped). Each save reads the
 * workspace the previous one reloaded, so it carries the view's newest rowVersion.
 */
const columnQueues = new Map<string, { pending: ListColumn[] | null }>()

/** The newest waiting list (read through a call: a save may have queued one meanwhile). */
const takePending = (queue: { pending: ListColumn[] | null }) => queue.pending

/** Draws a change at once, before the server answers. */
function showPatch(queryClient: QueryClient, id: string, patch: WorkspacePatch) {
  queryClient.setQueryData<Workspace>(pmKeys.workspace(id), (current) =>
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
}

/**
 * Saves a change to the open workspace (name, description, favourite, members, columns, a view),
 * showing what it can at once; a refused change reloads the workspace and the global toast
 * explains why. Column changes made in quick succession are queued (see `columnQueues`).
 */
export function useWorkspacePatch(workspace: Workspace) {
  const queryClient = useQueryClient()
  const update = useUpdateWorkspace()
  const key = pmKeys.workspace(workspace.id)

  const saveColumns = async (columns: ListColumn[]): Promise<boolean> => {
    showPatch(queryClient, workspace.id, { columns })
    const queued = columnQueues.get(workspace.id)
    if (queued) {
      queued.pending = columns
      return true
    }
    const queue: { pending: ListColumn[] | null } = { pending: null }
    columnQueues.set(workspace.id, queue)
    let next: ListColumn[] | null = columns
    try {
      while (next) {
        queue.pending = null
        // The cached workspace: after an earlier save it holds the reloaded rowVersions.
        const latest = queryClient.getQueryData<Workspace>(key) ?? workspace
        await update.mutateAsync({ workspace: latest, patch: { columns: next } })
        next = takePending(queue)
        // The save reloaded the workspace with the server's columns: draw the waiting ones again.
        if (next) showPatch(queryClient, workspace.id, { columns: next })
      }
      return true
    } catch {
      await queryClient.invalidateQueries({ queryKey: key })
      return false
    } finally {
      columnQueues.delete(workspace.id)
    }
  }

  const save = async (patch: WorkspacePatch, success?: string): Promise<boolean> => {
    const onlyColumns =
      patch.columns !== undefined && Object.keys(patch).every((name) => name === 'columns')
    if (onlyColumns && patch.columns) {
      const ok = await saveColumns(patch.columns)
      if (ok && success) toast.success(success)
      return ok
    }
    showPatch(queryClient, workspace.id, patch)
    try {
      await update.mutateAsync({ workspace, patch })
      if (success) toast.success(success)
      return true
    } catch {
      await queryClient.invalidateQueries({ queryKey: key })
      return false
    }
  }

  return { save, saving: update.isPending }
}
