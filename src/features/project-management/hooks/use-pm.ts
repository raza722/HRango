import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { pmApi, pmKeys, pmLookupsQueryOptions, pmTreeQueryOptions } from '../api/pm.api'
import type {
  CommentInput,
  CommentPatch,
  PmPerson,
  ShareSettings,
  TagInput,
  TaskInput,
  TaskPatch,
  WorkspaceInput,
  WorkspaceItem,
  WorkspaceItemInput,
  WorkspacePatch,
} from '../types/pm.types'

// --- queries ------------------------------------------------------------------------------------

export const usePmLookups = () => useQuery(pmLookupsQueryOptions())

/** People by id, for avatars and names across the module. */
export function usePeople(): Map<string, PmPerson> {
  const { data } = usePmLookups()
  return useMemo(
    () => new Map((data?.employees ?? []).map((person) => [person.id, person])),
    [data],
  )
}

export const useWorkspaceTree = () => useQuery(pmTreeQueryOptions())

export const useTasks = (workspaceId: string, listId: string | null) =>
  useQuery({
    queryKey: pmKeys.tasks(workspaceId, listId),
    queryFn: ({ signal }) => pmApi.tasks(workspaceId, listId, signal),
  })

export const useComments = (taskId: string | null) =>
  useQuery({
    queryKey: pmKeys.comments(taskId ?? ''),
    queryFn: ({ signal }) => pmApi.comments(taskId ?? '', signal),
    enabled: taskId !== null,
  })

export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: pmKeys.tags(workspaceId),
    queryFn: ({ signal }) => pmApi.tags(workspaceId, signal),
  })

export const useShare = (targetId: string | null) =>
  useQuery({
    queryKey: pmKeys.share(targetId ?? ''),
    queryFn: ({ signal }) => pmApi.share(targetId ?? '', signal),
    enabled: targetId !== null,
  })

// --- mutations ----------------------------------------------------------------------------------

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
  usePmMutation(({ id, patch }: { id: string; patch: WorkspacePatch }) =>
    pmApi.updateWorkspace(id, patch),
  )

export const useDeleteWorkspace = () =>
  usePmMutation((id: string) => pmApi.deleteWorkspace(id), 'Workspace deleted')

export const useCreateItem = () =>
  usePmMutation(({ workspaceId, input }: { workspaceId: string; input: WorkspaceItemInput }) =>
    pmApi.createItem(workspaceId, input),
  )

export const useUpdateItem = () =>
  usePmMutation(
    ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<WorkspaceItem, 'name' | 'favorite' | 'parentId'>>
    }) => pmApi.updateItem(id, patch),
  )

export const useDeleteItem = () => usePmMutation((id: string) => pmApi.deleteItem(id))

export const useCreateTask = () => usePmMutation((input: TaskInput) => pmApi.createTask(input))

export const useUpdateTask = () =>
  usePmMutation(({ id, patch }: { id: string; patch: TaskPatch }) => pmApi.updateTask(id, patch))

export const useDeleteTask = () =>
  usePmMutation((id: string) => pmApi.deleteTask(id), 'Task deleted')

export const useAddComment = () =>
  usePmMutation(({ taskId, input }: { taskId: string; input: CommentInput }) =>
    pmApi.addComment(taskId, input),
  )

export const useUpdateComment = () =>
  usePmMutation(({ id, patch }: { id: string; patch: CommentPatch }) =>
    pmApi.updateComment(id, patch),
  )

export const useDeleteComment = () => usePmMutation((id: string) => pmApi.deleteComment(id))

export const useCreateTag = () =>
  usePmMutation(({ workspaceId, input }: { workspaceId: string; input: TagInput }) =>
    pmApi.createTag(workspaceId, input),
  )

export const useUpdateTag = () =>
  usePmMutation(({ id, patch }: { id: string; patch: Partial<TagInput> }) =>
    pmApi.updateTag(id, patch),
  )

export const useDeleteTag = () => usePmMutation((id: string) => pmApi.deleteTag(id))

export const useSaveShare = () =>
  usePmMutation((settings: ShareSettings) => pmApi.saveShare(settings), 'Sharing saved')
