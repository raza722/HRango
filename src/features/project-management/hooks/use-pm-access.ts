import { useCan } from '@/lib/permissions'

import { rankOf } from '../api/pm.mappers'
import type { PmRole, TaskColumnKey, Workspace } from '../types/pm.types'

/**
 * What the caller may do. The company permission codes (`projects.*`) open the module and its
 * actions; inside a workspace the caller's workspace role decides (backend README "Workspace
 * roles": admin 5, HR 4, manager 3, team leader 2, contributor 1, a reader who is not a member 0).
 * The API checks every request anyway; this only hides what would be refused.
 */
export function usePmAccess(workspace: Pick<Workspace, 'myRole'> | null | undefined) {
  const rank = rankOf(workspace?.myRole ?? null)
  const codes = {
    createWorkspace: useCan('projects.workspaces.create'),
    editWorkspace: useCan('projects.workspaces.edit'),
    deleteWorkspace: useCan('projects.workspaces.delete'),
    createList: useCan('projects.lists.create'),
    createTask: useCan('projects.tasks.create'),
    editTask: useCan('projects.tasks.edit'),
    deleteTask: useCan('projects.tasks.delete'),
    assign: useCan('projects.tasks.assign'),
    comment: useCan('projects.comments.create'),
    editComment: useCan('projects.comments.edit'),
    deleteComment: useCan('projects.comments.delete'),
    trackTime: useCan('projects.time_tracking.create'),
    deleteTime: useCan('projects.time_tracking.delete'),
    remind: useCan('projects.reminders.create'),
    viewSharing: useCan('projects.sharing.view'),
    share: useCan('projects.sharing.edit'),
  }
  return {
    rank,
    createWorkspace: codes.createWorkspace,
    /** Rename, description, cover, members, column permissions, shared views: admins and HR. */
    editWorkspace: codes.editWorkspace && rank >= 4,
    deleteWorkspace: codes.deleteWorkspace && rank >= 5,
    /** Folders, lists, Convert to List, Labels (a custom field): managers and above. */
    manageLists: codes.createList && rank >= 3,
    /** Add tasks, move, tags, assign: team leaders and above. */
    addTasks: codes.createTask && rank >= 2,
    moveTasks: codes.editTask && rank >= 2,
    assign: codes.assign && rank >= 2,
    /** Contributors edit the tasks they created or are assigned; the API refuses the rest. */
    editTasks: codes.editTask && rank >= 1,
    /** Managers and above, or the task's creator (the API checks). */
    deleteTasks: codes.deleteTask && rank >= 1,
    comment: codes.comment && rank >= 1,
    editComments: codes.editComment,
    deleteComments: codes.deleteComment,
    trackTime: codes.trackTime && rank >= 1,
    deleteTime: codes.deleteTime && rank >= 1,
    remind: codes.remind,
    /** Sharing & Permissions: reading needs the code; saving needs managers and above. */
    viewSharing: codes.viewSharing,
    share: codes.share && rank >= 3,
  }
}

export type PmAccess = ReturnType<typeof usePmAccess>

/** Whether the caller may change a column's values (Can View / Private Field refuse; admins always may). */
export function columnEditable(
  workspace: Pick<Workspace, 'myRole' | 'myLevels'>,
  key: TaskColumnKey,
): boolean {
  if (workspace.myRole === 'workspace-admin') return true
  const level = workspace.myLevels[key]
  return level !== 'can-view' && level !== 'private'
}

export const roleRank = (role: PmRole | null) => rankOf(role)
