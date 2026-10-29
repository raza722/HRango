import { useMemo } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/auth-store'

import {
  type MentionContext,
  pmApi,
  pmKeys,
  pmTemplatesQueryOptions,
  pmTreeQueryOptions,
} from '../api/pm.api'
import type {
  ActivityFilters,
  ColumnPermission,
  CommentInput,
  CommentPatch,
  ExtensionRequest,
  PmLookups,
  PmPerson,
  Reminder,
  ReminderEntry,
  ShareEntity,
  ShareSettings,
  Tag,
  TagInput,
  TaskColumnKey,
  TaskComment,
  TaskInput,
  TaskList,
  TaskPatch,
  TaskRow,
  TimeEntryInput,
  Workspace,
  WorkspaceInput,
  WorkspaceItem,
  WorkspacePatch,
} from '../types/pm.types'

// --- who is signed in -------------------------------------------------------------------------------

/** The signed-in person's employee id (null for an account without one, such as the administrator). */
export const usePmMe = (): string | null => useAuthStore((state) => state.user?.employeeId ?? null)

// --- queries ------------------------------------------------------------------------------------------

export const usePmTemplates = () => useQuery(pmTemplatesQueryOptions())

/** The people picker's directory (every page of `GET /projects/people`) and who "me" is. */
export function usePmLookups() {
  const meId = usePmMe()
  return useQuery({
    queryKey: pmKeys.people(),
    queryFn: ({ signal }) => pmApi.people(signal),
    staleTime: 5 * 60_000,
    select: (employees): PmLookups => ({
      me: employees.find((person) => person.id === meId) ?? null,
      employees,
    }),
  })
}

export const useDepartments = () =>
  useQuery({
    queryKey: pmKeys.departments(),
    queryFn: ({ signal }) => pmApi.departments(signal),
    staleTime: 5 * 60_000,
  })

/** People by id, for avatars and names across the module. */
export function usePeople(): Map<string, PmPerson> {
  const { data } = usePmLookups()
  return useMemo(
    () => new Map((data?.employees ?? []).map((person) => [person.id, person])),
    [data],
  )
}

/** The Workspaces panel: the workspaces the caller can read. */
export const useWorkspaceTree = () => useQuery(pmTreeQueryOptions())

/** One workspace with its members, statuses, views, folders, lists and column permissions. */
export const useWorkspace = (id: string | null) =>
  useQuery({
    queryKey: pmKeys.workspace(id ?? ''),
    queryFn: ({ signal }) => pmApi.workspace(id ?? '', signal),
    enabled: id !== null,
  })

/** The List view's rows and the columns hidden from the caller. */
export const useTaskList = (workspaceId: string, listId: string | null) =>
  useQuery({
    queryKey: pmKeys.tasks(workspaceId, listId),
    queryFn: ({ signal }) => pmApi.tasks(workspaceId, listId, signal),
  })

const rowsOf = (list: TaskList): TaskRow[] => list.rows

/** The List view's rows. */
export const useTasks = (workspaceId: string, listId: string | null) =>
  useQuery({
    queryKey: pmKeys.tasks(workspaceId, listId),
    queryFn: ({ signal }) => pmApi.tasks(workspaceId, listId, signal),
    select: rowsOf,
  })

/** The task screen: links (dependencies) and what the caller may see. */
export const useTaskDetail = (taskId: string | null) =>
  useQuery({
    queryKey: pmKeys.task(taskId ?? ''),
    queryFn: ({ signal }) => pmApi.task(taskId ?? '', signal),
    enabled: taskId !== null,
  })

export const useComments = (taskId: string | null) =>
  useQuery({
    queryKey: pmKeys.comments(taskId ?? ''),
    queryFn: ({ signal }) => pmApi.comments(taskId ?? '', signal),
    enabled: taskId !== null,
  })

export const useAttachments = (taskId: string, enabled = true) =>
  useQuery({
    queryKey: pmKeys.attachments(taskId),
    queryFn: ({ signal }) => pmApi.attachments(taskId, signal),
    enabled,
  })

export const useTimeEntries = (taskId: string, enabled = true) =>
  useQuery({
    queryKey: pmKeys.timeEntries(taskId),
    queryFn: ({ signal }) => pmApi.timeEntries(taskId, signal),
    enabled,
  })

export const useReminder = (taskId: string, enabled = true) =>
  useQuery({
    queryKey: pmKeys.reminder(taskId),
    queryFn: ({ signal }) => pmApi.reminder(taskId, signal),
    enabled,
  })

export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: pmKeys.tags(workspaceId),
    queryFn: ({ signal }) => pmApi.tags(workspaceId, signal),
  })

export const useShare = (entityType: ShareEntity, entityId: string | null) =>
  useQuery({
    queryKey: pmKeys.share(entityType, entityId ?? ''),
    queryFn: ({ signal }) => pmApi.share(entityType, entityId ?? '', signal),
    enabled: entityId !== null,
  })

// --- mutations ----------------------------------------------------------------------------------------

/** Every mutation refreshes the module's queries: tree, tasks and comments read each other. */
function usePmMutation<A, R>(
  fn: (args: A) => Promise<R>,
  success?: string,
  /** The caller shows the error itself (on a field), so no error toast. */
  quiet = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    ...(quiet ? { meta: { suppressErrorToast: true } } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pmKeys.all })
      if (success) toast.success(success)
    },
  })
}

export const useCreateWorkspace = () =>
  usePmMutation((input: WorkspaceInput) => pmApi.createWorkspace(input), 'Workspace created', true)

export const useUpdateWorkspace = () =>
  usePmMutation(({ workspace, patch }: { workspace: Workspace; patch: WorkspacePatch }) =>
    pmApi.updateWorkspace(workspace, patch),
  )

export const useSetCover = () =>
  usePmMutation(
    ({ workspace, file }: { workspace: Workspace; file: File | null }) =>
      pmApi.setCover(workspace, file),
    'Cover changed',
  )

export const useDeleteWorkspace = () =>
  usePmMutation((workspace: Workspace) => pmApi.deleteWorkspace(workspace), 'Workspace deleted')

export const useSaveColumnPermission = () =>
  usePmMutation(
    ({
      workspace,
      key,
      permission,
    }: {
      workspace: Workspace
      key: TaskColumnKey
      permission: ColumnPermission
    }) => pmApi.saveColumnPermission(workspace, key, permission),
    'Permissions saved',
  )

export const useCreateItem = () =>
  usePmMutation(
    ({
      workspaceId,
      input,
    }: {
      workspaceId: string
      input: { kind: WorkspaceItem['kind']; name: string; parentId: string | null }
    }) => pmApi.createItem(workspaceId, input),
  )

export const useCreateTask = () => usePmMutation((input: TaskInput) => pmApi.createTask(input))

export const useUpdateTask = () =>
  usePmMutation(({ id, patch }: { id: string; patch: TaskPatch }) => pmApi.updateTask(id, patch))

export const useDeleteTask = () =>
  usePmMutation(
    (task: Pick<TaskRow, 'id' | 'rowVersion'>) => pmApi.deleteTask(task),
    'Task deleted',
  )

export const useAddDependency = () =>
  usePmMutation(
    ({
      taskId,
      otherTaskId,
      kind,
    }: {
      taskId: string
      otherTaskId: string
      kind: 'waiting_on' | 'blocking'
    }) => pmApi.addDependency(taskId, otherTaskId, kind),
  )

export const useRemoveDependency = () =>
  usePmMutation((dependencyId: string) => pmApi.removeDependency(dependencyId))

export const useAddComment = () =>
  usePmMutation(
    ({
      taskId,
      input,
      context,
    }: {
      taskId: string
      input: CommentInput
      context: MentionContext
    }) => pmApi.addComment(taskId, input, context),
  )

export const useUpdateComment = () =>
  usePmMutation(
    ({
      comment,
      patch,
      context,
    }: {
      comment: TaskComment
      patch: CommentPatch
      context: MentionContext
    }) => pmApi.updateComment(comment, patch, context),
  )

export const useDeleteComment = () =>
  usePmMutation((comment: TaskComment) => pmApi.deleteComment(comment))

export const useAddAttachment = () =>
  usePmMutation(
    ({
      taskId,
      file,
      onProgress,
    }: {
      taskId: string
      file: File
      onProgress?: (percent: number) => void
    }) => pmApi.addAttachment(taskId, file, onProgress),
    undefined,
    true,
  )

export const useDeleteAttachment = () =>
  usePmMutation((id: string) => pmApi.deleteAttachment(id), 'File removed')

export const useAddTimeEntry = () =>
  usePmMutation(({ taskId, input }: { taskId: string; input: TimeEntryInput }) =>
    pmApi.addTimeEntry(taskId, input),
  )

export const useDeleteTimeEntry = () => usePmMutation((id: string) => pmApi.deleteTimeEntry(id))

export const useStartTimer = () => usePmMutation((taskId: string) => pmApi.startTimer(taskId))

export const useStopTimer = () => usePmMutation((notes?: string) => pmApi.stopTimer(notes))

export const useSetReminder = () =>
  usePmMutation(
    ({
      task,
      at,
      current,
    }: {
      task: Pick<TaskRow, 'id' | 'name'>
      at: Date | null
      current: Reminder | null
    }) => pmApi.setReminder(task, at, current),
  )

/** The Activity view: a workspace's history, newest first, a page at a time ("Load more"). */
export const useWorkspaceActivity = (workspaceId: string, filters: ActivityFilters) =>
  useInfiniteQuery({
    queryKey: pmKeys.activity(workspaceId, filters),
    queryFn: ({ pageParam, signal }) => pmApi.activity(workspaceId, filters, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    placeholderData: keepPreviousData,
  })

/** The Reminders page: the caller's reminders (`includeDone` adds the sent and past ones). */
export const useReminders = (includeDone: boolean) =>
  useQuery({
    queryKey: pmKeys.reminders(includeDone),
    queryFn: ({ signal }) => pmApi.reminders(includeDone, signal),
  })

export const useMoveReminder = () =>
  usePmMutation(
    ({ reminder, at }: { reminder: ReminderEntry; at: Date }) => pmApi.moveReminder(reminder, at),
    'Reminder moved',
  )

export const useDeleteReminder = () =>
  usePmMutation((id: string) => pmApi.deleteReminder(id), 'Reminder deleted')

/** Request Extension: the error stays in the popup (on its fields). */
export const useRequestExtension = () =>
  usePmMutation(
    ({ taskId, input }: { taskId: string; input: { newDueDate: string; reason: string } }) =>
      pmApi.requestExtension(taskId, input),
    'Extension requested',
    true,
  )

/** Approve / Reject an extension request; approving moves the due date. */
export const useDecideExtension = () =>
  usePmMutation(
    ({
      extension,
      decision,
      remarks,
    }: {
      extension: Pick<ExtensionRequest, 'id' | 'rowVersion'>
      decision: 'approve' | 'reject'
      remarks: string | null
    }) => pmApi.decideExtension(extension, decision, remarks),
    undefined,
    true,
  )

export const useCreateTag = () =>
  usePmMutation(({ workspaceId, input }: { workspaceId: string; input: TagInput }) =>
    pmApi.createTag(workspaceId, input),
  )

export const useUpdateTag = () =>
  usePmMutation(({ tag, patch }: { tag: Tag; patch: Partial<TagInput> }) =>
    pmApi.updateTag(tag, patch),
  )

export const useDeleteTag = () => usePmMutation((tag: Tag) => pmApi.deleteTag(tag))

export const useSaveShare = () =>
  usePmMutation((settings: ShareSettings) => pmApi.saveShare(settings), 'Sharing saved')
