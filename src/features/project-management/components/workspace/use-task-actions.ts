import { useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

import { pmApi, pmKeys } from '../../api/pm.api'
import { useDeleteTask, useUpdateTask } from '../../hooks/use-pm'
import type {
  TaskList,
  TaskPatch,
  TaskRow,
  TaskType,
  Workspace,
  WorkspaceTree,
} from '../../types/pm.types'

/** Where "Move To" sends a task: a workspace's top level or one of its lists. */
export interface MoveTarget {
  workspaceId: string
  listId: string | null
  /** The list's name, for the message. */
  listName?: string | null | undefined
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
    queryClient.setQueryData<TaskList>(key, (list) =>
      list
        ? { ...list, rows: list.rows.map((row) => (row.id === id ? { ...row, ...changes } : row)) }
        : list,
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
      // Said at once: the refresh reloads every Project Management list and can take a while.
      toast.success(success(result))
      await refresh()
      return result
    } catch (error) {
      toast.error(message(error))
      await refresh()
      return undefined
    }
  }

  const listName = (id: string | null) =>
    id ? (workspace.items.find((item) => item.id === id)?.name ?? null) : null

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

    /** Remind Me: the caller's own reminder on the task (`/reminders`); null removes it. */
    setReminder: (task: TaskRow, at: Date | null) =>
      run(
        async () => {
          const current = await pmApi.reminder(task.id)
          await pmApi.setReminder(task, at, current)
        },
        () => (at ? 'Reminder set' : 'Reminder removed'),
      ),

    /** Moves a task and its subtasks to a list, or to a workspace's top level. */
    moveTo: (task: TaskRow, target: MoveTarget) => {
      const destination =
        target.workspaceId === workspace.id
          ? workspace.name
          : (tree.workspaces.find((entry) => entry.id === target.workspaceId)?.name ?? 'workspace')
      return run(
        () => pmApi.moveTask(task.id, { workspaceId: target.workspaceId, listId: target.listId }),
        () => `Moved to ${target.listName ?? listName(target.listId) ?? destination}`,
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

    /** A new list named after the task; its subtasks become the list's tasks (`convert-to-list`). */
    convertToList: (task: TaskRow) =>
      run(
        async () => ({ id: await pmApi.convertToList(task), name: task.name }),
        (list) => `${list.name} is now a list`,
      ),

    remove: (task: TaskRow) => {
      deleteTask.mutate(task)
    },

    /** Bulk delete; a subtask whose task is also going goes with it. */
    removeMany: (ids: readonly string[]) => {
      const doomed = new Set(ids)
      const roots = tasks.filter(
        (row) => doomed.has(row.id) && (!row.parentId || !doomed.has(row.parentId)),
      )
      return run(
        () => Promise.all(roots.map((row) => pmApi.deleteTask(row))),
        () => (ids.length === 1 ? 'Task deleted' : `${ids.length} tasks deleted`),
      )
    },

    /** Drag and drop: a new place among the siblings, and the status of the group dropped in. */
    reorder: (task: TaskRow, order: number, statusId: string) => {
      patch(task.id, statusId === task.statusId ? { order } : { order, statusId })
    },

    /**
     * Calendar and Timeline: new start and due dates (`yyyy-MM-dd`, or null to clear). A start
     * after the due date is refused here, before anything is sent.
     */
    setDates: (task: TaskRow, dates: { startDate: string | null; dueDate: string | null }) => {
      if (dates.startDate === task.startDate && dates.dueDate === task.dueDate) return
      if (dates.startDate && dates.dueDate && dates.startDate > dates.dueDate) {
        toast.error('The start date cannot be after the due date')
        return
      }
      patch(
        task.id,
        {
          startDate: dates.startDate,
          dueDate: dates.dueDate,
          ...(dates.startDate ? {} : { startTime: null }),
          ...(dates.dueDate ? {} : { dueTime: null }),
        },
        dates.dueDate
          ? `${task.name} is due ${format(parseISO(dates.dueDate), 'd MMM yyyy')}`
          : `${task.name} has no due date`,
      )
    },
  }
}

export type TaskActions = ReturnType<typeof useTaskActions>
