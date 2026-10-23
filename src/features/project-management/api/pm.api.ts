import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  CommentInput,
  CommentPatch,
  PmLookups,
  ShareSettings,
  Tag,
  TagInput,
  Task,
  TaskComment,
  TaskInput,
  TaskPatch,
  TaskRow,
  Workspace,
  WorkspaceInput,
  WorkspaceItem,
  WorkspaceItemInput,
  WorkspacePatch,
  WorkspaceTree,
} from '../types/pm.types'

const path = (rest: string) => `/project-management${rest}`

async function getData<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params } : {}),
    signal,
  })
  return data.data
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string) {
  await apiClient.delete(path(url))
}

export const pmApi = {
  lookups: (signal?: AbortSignal) => getData<PmLookups>('/lookups', undefined, signal),

  tree: (signal?: AbortSignal) => getData<WorkspaceTree>('/workspaces', undefined, signal),
  createWorkspace: (input: WorkspaceInput) => send<Workspace>('post', '/workspaces', input),
  updateWorkspace: (id: string, patch: WorkspacePatch) =>
    send<Workspace>('patch', `/workspaces/${id}`, patch),
  deleteWorkspace: (id: string) => remove(`/workspaces/${id}`),

  createItem: (workspaceId: string, input: WorkspaceItemInput) =>
    send<WorkspaceItem>('post', `/workspaces/${workspaceId}/items`, input),
  updateItem: (id: string, patch: Partial<Pick<WorkspaceItem, 'name' | 'favorite' | 'parentId'>>) =>
    send<WorkspaceItem>('patch', `/items/${id}`, patch),
  deleteItem: (id: string) => remove(`/items/${id}`),

  /** A workspace's tasks, or one list's when `listId` is given (subtasks included). */
  tasks: (workspaceId: string, listId: string | null, signal?: AbortSignal) =>
    getData<TaskRow[]>(`/workspaces/${workspaceId}/tasks`, listId ? { listId } : undefined, signal),
  createTask: (input: TaskInput) => send<Task>('post', '/tasks', input),
  updateTask: (id: string, patch: TaskPatch) => send<Task>('patch', `/tasks/${id}`, patch),
  deleteTask: (id: string) => remove(`/tasks/${id}`),
  /** Moves a task and its subtasks to another workspace (and list); they keep their IDs. */
  moveTask: (id: string, target: { workspaceId: string; listId: string | null }) =>
    send<Task>('post', `/tasks/${id}/move`, target),

  comments: (taskId: string, signal?: AbortSignal) =>
    getData<TaskComment[]>(`/tasks/${taskId}/comments`, undefined, signal),
  addComment: (taskId: string, input: CommentInput) =>
    send<TaskComment>('post', `/tasks/${taskId}/comments`, input),
  updateComment: (id: string, patch: CommentPatch) =>
    send<TaskComment>('patch', `/comments/${id}`, patch),
  deleteComment: (id: string) => remove(`/comments/${id}`),

  tags: (workspaceId: string, signal?: AbortSignal) =>
    getData<Tag[]>(`/workspaces/${workspaceId}/tags`, undefined, signal),
  createTag: (workspaceId: string, input: TagInput) =>
    send<Tag>('post', `/workspaces/${workspaceId}/tags`, input),
  updateTag: (id: string, patch: Partial<TagInput>) => send<Tag>('patch', `/tags/${id}`, patch),
  deleteTag: (id: string) => remove(`/tags/${id}`),

  share: (targetId: string, signal?: AbortSignal) =>
    getData<ShareSettings>(`/shares/${targetId}`, undefined, signal),
  saveShare: (settings: ShareSettings) =>
    send<ShareSettings>('put', `/shares/${settings.targetId}`, settings),
}

export const pmKeys = {
  all: ['project-management'] as const,
  lookups: () => [...pmKeys.all, 'lookups'] as const,
  tree: () => [...pmKeys.all, 'tree'] as const,
  tasks: (workspaceId: string, listId: string | null) =>
    [...pmKeys.all, 'tasks', workspaceId, listId ?? 'all'] as const,
  comments: (taskId: string) => [...pmKeys.all, 'comments', taskId] as const,
  tags: (workspaceId: string) => [...pmKeys.all, 'tags', workspaceId] as const,
  share: (targetId: string) => [...pmKeys.all, 'share', targetId] as const,
}

export const pmLookupsQueryOptions = () =>
  queryOptions({
    queryKey: pmKeys.lookups(),
    queryFn: ({ signal }) => pmApi.lookups(signal),
    staleTime: 5 * 60_000,
  })

export const pmTreeQueryOptions = () =>
  queryOptions({ queryKey: pmKeys.tree(), queryFn: ({ signal }) => pmApi.tree(signal) })
