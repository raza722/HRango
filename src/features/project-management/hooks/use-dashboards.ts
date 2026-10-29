import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/lib/api-error'

import { dashboardKeys, dashboardsApi, type PersonalItem } from '../api/dashboards.api'
import { pmApi, pmKeys } from '../api/pm.api'
import type {
  Attachment,
  StatusGroup,
  TaskComment,
  TaskRow,
  TaskStatus,
  Workspace,
  WorkspaceSummary,
} from '../types/pm.types'
import { usePmMe, useWorkspaceTree } from './use-pm'

/** A task with what the dashboards need to group it: its workspace, status and whose it is. */
export interface DashboardTask extends TaskRow {
  workspaceName: string
  status: TaskStatus | null
  /** Its status's group; a status the workspace no longer has counts as not started. */
  group: StatusGroup
  /** In a Done or Closed status. */
  done: boolean
  /** Assigned to the signed-in person. */
  mine: boolean
}

export interface DashboardWorkspace {
  workspace: Workspace
  tasks: DashboardTask[]
}

/** Workspaces in a dashboard's scope, each with its folders, lists, statuses and every task. */
export interface DashboardData {
  /** The workspace list (or a workspace) is still loading. */
  isPending: boolean
  /** Nothing could be read; `error` says why. */
  error: ApiError | null
  /** The workspaces read, in the panel's order. */
  workspaces: DashboardWorkspace[]
  /** Workspaces in scope that could not be read (left out of the figures). */
  failed: { id: string; name: string; error: ApiError }[]
  tasks: DashboardTask[]
  /** Refetching after a change (the previous figures stay on screen). */
  isFetching: boolean
  refetch: () => void
}

/** What the page needs of each underlying query. */
interface QueryState {
  isPending: boolean
  isFetching: boolean
  error: ApiError | null
  refetch: () => unknown
}

function dashboardTask(row: TaskRow, workspace: Workspace, meId: string | null): DashboardTask {
  const status = workspace.setup.statuses.find((entry) => entry.id === row.statusId) ?? null
  const group = status?.group ?? 'not-started'
  return {
    ...row,
    workspaceName: workspace.name,
    status,
    group,
    done: group === 'done' || group === 'closed',
    mine: meId !== null && row.assigneeIds.includes(meId),
  }
}

/**
 * The workspaces a dashboard covers, from the Workspaces panel's list: the ones the caller is a
 * member of (`members`), or every one they can read (`readable`). Hidden ones are left out, as
 * in the panel.
 */
export function useScopeWorkspaces(scope: 'members' | 'readable') {
  const tree = useWorkspaceTree()
  const workspaces = useMemo(
    () =>
      (tree.data?.workspaces ?? []).filter(
        (workspace) => !workspace.hidden && (scope === 'readable' || workspace.myRole !== null),
      ),
    [tree.data, scope],
  )
  return { tree, workspaces }
}

/**
 * Each workspace's page data and all its tasks (`GET /workspaces/{id}` and `GET …/tasks`, the
 * List view's own queries, so the cache is shared). There is no cross-workspace endpoint
 * (Backend Dependencies T7), so a dashboard over several workspaces reads each one.
 */
export function useDashboardData(
  summaries: readonly Pick<WorkspaceSummary, 'id' | 'name'>[],
  treePending = false,
  treeError: ApiError | null = null,
): DashboardData {
  const meId = usePmMe()
  const details = useQueries({
    queries: summaries.map((summary) => ({
      queryKey: pmKeys.workspace(summary.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => pmApi.workspace(summary.id, signal),
    })),
  })
  const lists = useQueries({
    queries: summaries.map((summary) => ({
      queryKey: pmKeys.tasks(summary.id, null),
      queryFn: ({ signal }: { signal: AbortSignal }) => pmApi.tasks(summary.id, null, signal),
    })),
  })

  // A few workspaces of at most a few hundred tasks: cheap enough to assemble on each render.
  const workspaces: DashboardWorkspace[] = []
  const failed: DashboardData['failed'] = []
  summaries.forEach((summary, index) => {
    const workspace = details[index]?.data
    const list = lists[index]?.data
    const error = details[index]?.error ?? lists[index]?.error ?? null
    if (error) failed.push({ id: summary.id, name: summary.name, error })
    else if (workspace && list) {
      workspaces.push({
        workspace,
        tasks: list.rows.map((row) => dashboardTask(row, workspace, meId)),
      })
    }
  })

  const queries: QueryState[] = [details, lists].flat()
  const allFailed = summaries.length > 0 && failed.length === summaries.length
  return {
    isPending: treePending || queries.some((query) => query.isPending && !query.error),
    error: treeError ?? (allFailed ? (failed[0]?.error ?? null) : null),
    workspaces,
    failed,
    tasks: workspaces.flatMap((entry) => entry.tasks),
    isFetching: queries.some((query) => query.isFetching),
    refetch: () => {
      for (const query of queries) void query.refetch()
    },
  }
}

// --- comments and files across tasks -------------------------------------------------------------

export interface AssignedComment {
  comment: TaskComment
  task: DashboardTask
}

/**
 * Open comments assigned to the signed-in person: the comments of every task that has any
 * (`GET /tasks/{id}/comments`, the task screen's own query), kept when assigned to them and not
 * resolved, newest first.
 */
export function useAssignedComments(tasks: readonly DashboardTask[]) {
  const meId = usePmMe()
  const withComments = tasks.filter((task) => task.commentCount > 0)
  return useQueries({
    queries: withComments.map((task) => ({
      queryKey: pmKeys.comments(task.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => pmApi.comments(task.id, signal),
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      error: results.find((result) => result.error)?.error ?? null,
      refetch: () => {
        for (const result of results) if (result.error) void result.refetch()
      },
      comments: results
        .flatMap((result, index) => {
          const task = withComments[index]
          if (!task || !result.data) return []
          return result.data
            .filter((comment) => comment.assignedToId === meId && !comment.resolved)
            .map((comment): AssignedComment => ({ comment, task }))
        })
        .toSorted((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt)),
    }),
  })
}

export interface DashboardFile {
  attachment: Attachment
  task: DashboardTask
}

/** Files attached to the given tasks (`GET /tasks/{id}/attachments` for each task with any). */
export function useTaskFiles(tasks: readonly DashboardTask[]) {
  const withFiles = tasks.filter((task) => task.attachmentCount > 0)
  return useQueries({
    queries: withFiles.map((task) => ({
      queryKey: pmKeys.attachments(task.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => pmApi.attachments(task.id, signal),
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      error: results.find((result) => result.error)?.error ?? null,
      refetch: () => {
        for (const result of results) if (result.error) void result.refetch()
      },
      files: results
        .flatMap((result, index) => {
          const task = withFiles[index]
          if (!task || !result.data) return []
          return result.data.map((attachment): DashboardFile => ({ attachment, task }))
        })
        .toSorted((a, b) => b.attachment.uploadedAt.localeCompare(a.attachment.uploadedAt)),
    }),
  })
}

// --- favourites, recents, docs, personal list -----------------------------------------------------

export const useBookmarks = () =>
  useQuery({
    queryKey: dashboardKeys.bookmarks(),
    queryFn: ({ signal }) => dashboardsApi.bookmarks(signal),
  })

/** Pending endpoint (T7): answered by the mock in development. */
export const useRecents = (workspaceId: string | null, folderId: string | null) =>
  useQuery({
    queryKey: dashboardKeys.recents(workspaceId, folderId),
    queryFn: ({ signal }) =>
      dashboardsApi.recents(
        { workspaceId: workspaceId ?? undefined, folderId: folderId ?? undefined },
        signal,
      ),
  })

/** Pending endpoint (T1): answered by the mock in development. */
export const useDocs = (workspaceId: string | null, folderId: string | null) =>
  useQuery({
    queryKey: dashboardKeys.docs(workspaceId ?? '', folderId),
    queryFn: ({ signal }) => dashboardsApi.docs(workspaceId ?? '', folderId, signal),
    enabled: workspaceId !== null,
  })

/** Pending endpoint (T11): answered by the mock in development. */
export const usePersonalList = () =>
  useQuery({
    queryKey: dashboardKeys.personalList(),
    queryFn: ({ signal }) => dashboardsApi.personalList(signal),
  })

function usePersonalMutation<A, R>(fn: (args: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.personalList() })
    },
  })
}

export const useAddPersonalItem = () =>
  usePersonalMutation((input: { title: string; dueDate: string | null }) =>
    dashboardsApi.addPersonalItem(input),
  )

export const useSetPersonalItemDone = () =>
  usePersonalMutation(({ item, done }: { item: PersonalItem; done: boolean }) =>
    dashboardsApi.setPersonalItemDone(item, done),
  )

export const useDeletePersonalItem = () =>
  usePersonalMutation((item: PersonalItem) => dashboardsApi.deletePersonalItem(item))
