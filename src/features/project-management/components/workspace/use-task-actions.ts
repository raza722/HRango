import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pmApi, pmKeys } from '../../api/pm.api'
import { useDeleteTask, useUpdateTask } from '../../hooks/use-pm'
import type {
  TaskPatch,
  TaskRow,
  TaskType,
  Workspace,
  WorkspaceItem,
  WorkspaceTree,
} from '../../types/pm.types'
import { descendantIds } from './list-utils'

/** Where "Move To" sends a task: a workspace's top level or one of its lists. */
export interface MoveTarget {
  workspaceId: string
  listId: string | null
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.'

/**
 * The List view's task actions (row menu, rename, drag and drop). Small edits update the cached
 * rows first, so the list answers at once; every change refreshes the module's queries.
 */
export function useTaskActions({
  workspace,
  tree,
  listId,
  tasks,
}: {
  workspace: Workspace
  tree: WorkspaceTree
  listId: string | null
  tasks: readonly TaskRow[]
}) {
  const queryClient = useQueryClient()
  const update = useUpdateTask()
  const deleteTask = useDeleteTask()
  const key = pmKeys.tasks(workspace.id, listId)

  const refresh = () => queryClient.invalidateQueries({ queryKey: pmKeys.all })

  /** Applies a patch to the cached rows and saves it. */
  const patch = (id: string, changes: TaskPatch, success?: string) => {
    queryClient.setQueryData<TaskRow[]>(key, (rows) =>
      rows?.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    )
    update.mutate(
      { id, patch: changes },
      {
        onSuccess: () => {
          if (success) toast.success(success)
        },
        onError: () => {
          void refresh()
        },
      },
    )
  }

  /** Several calls in a row; a failure toasts and the list reloads from the server. */
  const run = async <T>(steps: () => Promise<T>, success: (result: T) => string) => {
    try {
      const result = await steps()
      await refresh()
      toast.success(success(result))
      return result
    } catch (error) {
      toast.error(message(error))
      await refresh()
      return undefined
    }
  }

  const listName = (id: string | null) =>
    id ? (tree.items.find((item) => item.id === id)?.name ?? null) : null

  return {
    rename: (task: TaskRow, name: string) => {
      const trimmed = name.trim()
      if (!trimmed || trimmed === task.name) return
      patch(task.id, { name: trimmed }, 'Task renamed')
    },

    toggleFavorite: (task: TaskRow) => {
      patch(
        task.id,
        { favorite: !task.favorite },
        task.favorite ? 'Removed from favorites' : 'Added to favorites',
      )
    },

    setType: (task: TaskRow, type: TaskType) => {
      if (task.type === type) return
      patch(
        task.id,
        { type },
        type === 'milestone' ? 'Task type set to Milestone' : 'Task type set to Task',
      )
    },

    setReminder: (task: TaskRow, at: Date | null) => {
      patch(
        task.id,
        { reminderAt: at ? at.toISOString() : null },
        at ? 'Reminder set' : 'Reminder removed',
      )
    },

    /** Moves a task and its subtasks to a list, or to a workspace's top level. */
    moveTo: (task: TaskRow, target: MoveTarget) => {
      const family = [...descendantIds(task.id, tasks)]
      if (target.workspaceId === workspace.id) {
        return run(
          () =>
            Promise.all(
              family.map((id) =>
                pmApi.updateTask(
                  id,
                  id === task.id
                    ? { listId: target.listId, parentId: null }
                    : { listId: target.listId },
                ),
              ),
            ),
          () => `Moved to ${listName(target.listId) ?? workspace.name}`,
        )
      }
      const destination = tree.workspaces.find((entry) => entry.id === target.workspaceId)
      if (!destination) return Promise.resolve(undefined)
      return run(
        () => pmApi.moveTask(task.id, { workspaceId: destination.id, listId: target.listId }),
        () => `Moved to ${listName(target.listId) ?? destination.name}`,
      )
    },

    convertToSubtask: (task: TaskRow, parent: TaskRow) => {
      patch(
        task.id,
        { parentId: parent.id, listId: parent.listId },
        `Now a subtask of ${parent.name}`,
      )
    },

    convertToTask: (task: TaskRow) => {
      patch(task.id, { parentId: null }, 'Now a task')
    },

    /** A new list named after the task; its subtasks become the list's tasks. */
    convertToList: (task: TaskRow) =>
      run(
        async (): Promise<WorkspaceItem> => {
          const current = task.listId
            ? tree.items.find((item) => item.id === task.listId)
            : undefined
          const list = await pmApi.createItem(workspace.id, {
            kind: 'list',
            name: task.name.slice(0, 80),
            parentId: current?.parentId ?? null,
          })
          const family = descendantIds(task.id, tasks)
          family.delete(task.id)
          await Promise.all(
            [...family].map((id) =>
              pmApi.updateTask(
                id,
                tasks.find((row) => row.id === id)?.parentId === task.id
                  ? { listId: list.id, parentId: null }
                  : { listId: list.id },
              ),
            ),
          )
          await pmApi.deleteTask(task.id)
          return list
        },
        (list) => `${list.name} is now a list`,
      ),

    remove: (task: TaskRow) => {
      deleteTask.mutate(task.id)
    },

    /** Bulk delete; a subtask whose task is also going goes with it. */
    removeMany: (ids: readonly string[]) => {
      const doomed = new Set(ids)
      const roots = ids.filter((id) => {
        const parentId = tasks.find((row) => row.id === id)?.parentId
        return !parentId || !doomed.has(parentId)
      })
      return run(
        () => Promise.all(roots.map((id) => pmApi.deleteTask(id))),
        () => (ids.length === 1 ? 'Task deleted' : `${ids.length} tasks deleted`),
      )
    },

    /** Drag and drop: a new place among the siblings, and the status of the group dropped in. */
    reorder: (task: TaskRow, order: number, statusId: string) => {
      patch(task.id, statusId === task.statusId ? { order } : { order, statusId })
    },
  }
}

export type TaskActions = ReturnType<typeof useTaskActions>
