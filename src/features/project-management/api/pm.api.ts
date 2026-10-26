import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import { uploadFile } from '@/lib/files'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  Attachment,
  ColumnPermission,
  CommentInput,
  CommentPatch,
  PmDepartment,
  PmPerson,
  PmRole,
  PmTemplates,
  Reminder,
  ShareEntity,
  ShareSettings,
  Tag,
  TagInput,
  TaskColumnKey,
  TaskComment,
  TaskDetail,
  TaskInput,
  TaskList,
  TaskPatch,
  TaskRow,
  TimeEntry,
  TimeEntryInput,
  Workspace,
  WorkspaceInput,
  WorkspaceItem,
  WorkspacePatch,
  WorkspaceSummary,
  WorkspaceTree,
} from '../types/pm.types'
import type {
  AttachmentDto,
  ColumnPermissionsDto,
  CommentDto,
  CustomFieldDto,
  FavoriteDto,
  LookupItemDto,
  MentionInDto,
  PersonDto,
  ReminderDto,
  ShareDto,
  TagDto,
  TaskDto,
  TaskFieldsDto,
  TaskPageDto,
  TemplateDto,
  TimeEntryDto,
  WorkspaceCreateDto,
  WorkspaceDto,
  WorkspaceSummaryDto,
  WorkspaceUpdateDto,
} from './pm.dto'
import {
  attachmentFromApi,
  columnsToConfig,
  columnsView,
  columnToApi,
  commentFromApi,
  featureToApi,
  folderApiId,
  labelId,
  labelOptions,
  labelParts,
  labelsFromField,
  permissionToApi,
  personFromApi,
  recurrenceToApi,
  reminderFromApi,
  roleToApi,
  shareFromApi,
  shareToApi,
  statusGroupToApi,
  tagFromApi,
  taskDetailFromApi,
  taskRowFromApi,
  templatesFromApi,
  timeEntryFromApi,
  toApiId,
  viewToApi,
  workspaceFromApi,
  workspaceSummaryFromApi,
} from './pm.mappers'

/** Everything Project Management calls lives under `/projects`. */
const path = (rest: string) => `/projects${rest}`

/** The API's largest page; lists the screens show whole are read page by page. */
const PAGE_SIZE = 100

async function getItem<T>(url: string, params?: object, signal?: AbortSignal): Promise<T> {
  const { data } = await apiClient.get<ApiItem<T>>(url, {
    ...(params ? { params } : {}),
    ...(signal ? { signal } : {}),
  })
  return data.data
}

/** Every page of a list (`?page&pageSize`), in order. */
async function getAll<T>(
  url: string,
  params: object = {},
  signal?: AbortSignal,
  onPage?: (page: Paginated<T> & Partial<Pick<TaskPageDto, 'hiddenColumns'>>) => void,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page += 1) {
    const { data } = await apiClient.get<
      Paginated<T> & Partial<Pick<TaskPageDto, 'hiddenColumns'>>
    >(url, {
      params: { ...params, page, pageSize: PAGE_SIZE },
      ...(signal ? { signal } : {}),
    })
    onPage?.(data)
    out.push(...data.data)
    if (page >= data.meta.totalPages) return out
  }
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(url, body ?? {})
  return data.data
}

async function remove(url: string, rowVersion?: string | null) {
  await apiClient.delete(url, rowVersion ? { params: { rowVersion } } : undefined)
}

// --- mentions --------------------------------------------------------------------------------------------

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** What a comment mentions: `@Name` of a person, `#HR…` of a task. */
export interface MentionContext {
  people: readonly PmPerson[]
  tasks: readonly Pick<TaskRow, 'id' | 'code'>[]
}

export function mentionsIn(body: string, context: MentionContext): MentionInDto[] {
  const out: MentionInDto[] = []
  for (const person of context.people) {
    if (new RegExp(`@${escape(person.name)}(?![\\w])`).test(body)) {
      out.push({ employeeId: toApiId(person.id) })
    }
  }
  for (const task of context.tasks) {
    if (task.code && body.includes(`#${task.code}`)) out.push({ taskId: toApiId(task.id) })
  }
  return out
}

// --- tasks: the parts of a patch and where each goes -------------------------------------------------------

const FIELD_KEYS = [
  'name',
  'description',
  'type',
  'priority',
  'startDate',
  'startTime',
  'dueDate',
  'dueTime',
  'recurrence',
  'rating',
  'timeEstimateMinutes',
] as const satisfies readonly (keyof TaskPatch)[]

function taskFields(current: TaskDetail, patch: TaskPatch, url: string | null): TaskFieldsDto {
  const next = { ...current, ...patch }
  return {
    name: next.name,
    description: next.description.trim() === '' ? null : next.description,
    taskType: next.type,
    priority: next.priority,
    startDate: next.startDate,
    startTime: next.startDate ? next.startTime : null,
    dueDate: next.dueDate,
    dueTime: next.dueDate ? next.dueTime : null,
    timeEstimateMinutes: next.timeEstimateMinutes,
    rating: next.rating > 0 ? next.rating : null,
    url,
    recurrence: recurrenceToApi(next.recurrence),
  }
}

const has = (patch: TaskPatch, key: keyof TaskPatch) => patch[key] !== undefined

async function getTaskDto(id: string, signal?: AbortSignal) {
  return getItem<TaskDto>(path(`/tasks/${id}`), undefined, signal)
}

/** The workspace's Labels field (type labels), if it has one. */
async function labelsField(workspaceId: string, signal?: AbortSignal) {
  const fields = await getItem<CustomFieldDto[]>(
    path(`/workspaces/${workspaceId}/custom-fields`),
    undefined,
    signal,
  )
  return fields.find((field) => field.fieldType === 'labels')
}

/**
 * Saves a List view edit. The API keeps each part behind its own endpoint: the task's own fields
 * (`PUT /tasks/{id}`, replaced as a whole from a fresh read), status, assignees and story points,
 * tags, labels (a custom field), place (move), and favourite. Parts run in that order; the first
 * refusal stops the rest.
 */
async function updateTask(id: string, patch: TaskPatch): Promise<TaskDetail> {
  let dto = await getTaskDto(id)
  if (FIELD_KEYS.some((key) => has(patch, key))) {
    dto = await send<TaskDto>('put', path(`/tasks/${id}`), {
      ...taskFields(taskDetailFromApi(dto), patch, dto.url),
      rowVersion: dto.rowVersion,
    })
  }
  if (has(patch, 'statusId') && patch.statusId !== dto.statusId) {
    dto = await send<TaskDto>('patch', path(`/tasks/${id}/status`), {
      statusId: toApiId(patch.statusId ?? ''),
      rowVersion: dto.rowVersion,
    })
  }
  if (has(patch, 'assigneeIds') || has(patch, 'storyPoints')) {
    const current = taskDetailFromApi(dto)
    const ids = patch.assigneeIds ?? current.assigneeIds
    const points = new Map(
      (patch.storyPoints ?? current.storyPoints).map((entry) => [entry.employeeId, entry.points]),
    )
    dto = await send<TaskDto>('put', path(`/tasks/${id}/assignees`), {
      assignees: ids.map((employeeId) => ({
        employeeId: toApiId(employeeId),
        storyPoints: points.get(employeeId) ?? null,
      })),
    })
  }
  if (has(patch, 'tagIds')) {
    dto = await send<TaskDto>('put', path(`/tasks/${id}/tags`), {
      tagIds: (patch.tagIds ?? []).map(toApiId),
    })
  }
  if (has(patch, 'labelIds')) {
    const ids = patch.labelIds ?? []
    const current = taskDetailFromApi(dto).labelIds
    const fieldId =
      [...ids, ...current].map((entry) => labelParts(entry).fieldId)[0] ??
      (await labelsField(dto.workspaceId))?.id
    if (fieldId) {
      const options = ids
        .map(labelParts)
        .filter((entry) => entry.fieldId === fieldId)
        .map((entry) => entry.option)
      dto = await send<TaskDto>('put', path(`/tasks/${id}/fields/${fieldId}`), {
        value: options.length > 0 ? options : null,
      })
    }
  }
  if (has(patch, 'listId') || has(patch, 'parentId') || has(patch, 'order')) {
    const listId = patch.listId === undefined ? dto.taskListId : patch.listId
    const parentId = patch.parentId === undefined ? dto.parentTaskId : patch.parentId
    dto = await send<TaskDto>('post', path(`/tasks/${id}/move`), {
      workspaceId: toApiId(dto.workspaceId),
      taskListId: listId ? toApiId(listId) : null,
      parentTaskId: parentId ? toApiId(parentId) : null,
      sortOrder: patch.order === undefined ? null : Math.round(patch.order),
      rowVersion: dto.rowVersion,
    })
  }
  if (has(patch, 'favorite')) {
    await send('put', path('/favorites'), {
      entityType: 'task',
      entityId: toApiId(id),
      kind: 'favorite',
      on: patch.favorite === true,
    })
    dto = { ...dto, isFavorite: patch.favorite === true }
  }
  return taskDetailFromApi(dto)
}

// --- workspaces ---------------------------------------------------------------------------------------------

function workspaceBody(input: WorkspaceInput): WorkspaceCreateDto {
  const { setup } = input
  return {
    name: input.name,
    description: input.description || null,
    privacy: input.visibility,
    ownerId: toApiId(input.ownerId),
    departmentId: toApiId(input.departmentId),
    workflowTemplate: input.template,
    statusMode: setup.statusMode,
    statusTemplate: setup.statusMode === 'custom' ? setup.statusTemplate : null,
    statuses: setup.statuses.map((status) => ({
      name: status.name,
      color: status.color,
      statusGroup: statusGroupToApi(status.group),
    })),
    views: setup.views.map((kind) => ({
      viewType: viewToApi(kind),
      isDefault: kind === setup.defaultView,
    })),
    features: setup.organizer.map((feature) => ({ featureCode: featureToApi(feature) })),
    members: input.memberIds
      .filter((id) => id !== input.ownerId)
      .map((employeeId) => ({ employeeId: toApiId(employeeId), memberRole: 'contributor' })),
  }
}

/**
 * Saves the List view's columns: in the workspace's List view when the caller may change shared
 * views (workspace admins and HR), otherwise in their own private List view.
 */
async function saveColumns(workspace: Workspace, patch: WorkspacePatch) {
  if (!patch.columns) return
  const config = columnsToConfig(patch.columns, workspace.labelsFieldId)
  const own = columnsView(workspace.views)
  const mayShare = workspace.myRole === 'workspace-admin' || workspace.myRole === 'hr'
  if (own && (own.isPrivate || mayShare)) {
    await send('put', path(`/views/${own.id}`), {
      viewType: 'list',
      name: own.name,
      taskListId: null,
      config: { ...own.config, ...config },
      isPrivate: own.isPrivate,
      isDefault: own.isDefault,
      rowVersion: own.rowVersion,
    })
    return
  }
  await send('post', path(`/workspaces/${workspace.id}/views`), {
    viewType: 'list',
    name: 'List',
    config,
    isPrivate: true,
  })
}

async function updateWorkspace(workspace: Workspace, patch: WorkspacePatch): Promise<void> {
  if (patch.name !== undefined || patch.description !== undefined || patch.visibility) {
    const body: WorkspaceUpdateDto = {
      name: patch.name ?? workspace.name,
      description: (patch.description ?? workspace.description) || null,
      privacy: patch.visibility ?? workspace.visibility,
      ownerId: toApiId(workspace.ownerId),
      departmentId: toApiId(workspace.departmentId ?? ''),
      rowVersion: workspace.rowVersion,
    }
    await send('put', path(`/workspaces/${workspace.id}`), body)
  }
  if (patch.favorite !== undefined) {
    await send('put', path('/favorites'), {
      entityType: 'workspace',
      entityId: toApiId(workspace.id),
      kind: 'favorite',
      on: patch.favorite,
    })
  }
  if (patch.addMemberIds?.length) {
    await send('post', path(`/workspaces/${workspace.id}/members`), {
      members: patch.addMemberIds.map((employeeId) => ({
        employeeId: toApiId(employeeId),
        memberRole: 'contributor',
      })),
    })
  }
  if (patch.addView) {
    await send('post', path(`/workspaces/${workspace.id}/views`), {
      viewType: viewToApi(patch.addView),
      name:
        patch.addView === 'mind-map'
          ? 'Mind Map'
          : `${patch.addView.charAt(0).toUpperCase()}${patch.addView.slice(1)}`,
    })
  }
  await saveColumns(workspace, patch)
}

// --- the API -------------------------------------------------------------------------------------------------

export const pmApi = {
  /** Define Workflow cards and the Status Templates list. */
  templates: async (signal?: AbortSignal): Promise<PmTemplates> => {
    const [workflows, statuses] = await Promise.all([
      getItem<TemplateDto[]>(path('/templates'), { kind: 'workflow' }, signal),
      getItem<TemplateDto[]>(path('/templates'), { kind: 'status' }, signal),
    ])
    return templatesFromApi(workflows, statuses)
  },

  /** The people picker: everyone (or a workspace's members, with `workspaceId`). */
  people: async (signal?: AbortSignal): Promise<PmPerson[]> =>
    (await getAll<PersonDto>(path('/people'), {}, signal)).map(personFromApi),

  /** Departments for Define Workflow (`GET /organisation/lookups/departments`). */
  departments: async (signal?: AbortSignal): Promise<PmDepartment[]> =>
    (await getItem<LookupItemDto[]>('/organisation/lookups/departments', undefined, signal)).map(
      (entry) => ({ id: entry.id, name: entry.name }),
    ),

  workspaces: async (signal?: AbortSignal): Promise<WorkspaceSummary[]> =>
    (await getAll<WorkspaceSummaryDto>(path('/workspaces'), {}, signal)).map(
      workspaceSummaryFromApi,
    ),

  /** A workspace with its column permissions and its Labels field. */
  workspace: async (id: string, signal?: AbortSignal): Promise<Workspace> => {
    const [dto, permissions, fields] = await Promise.all([
      getItem<WorkspaceDto>(path(`/workspaces/${id}`), undefined, signal),
      getItem<ColumnPermissionsDto>(
        path(`/workspaces/${id}/column-permissions`),
        undefined,
        signal,
      ),
      getItem<CustomFieldDto[]>(path(`/workspaces/${id}/custom-fields`), undefined, signal),
    ])
    return workspaceFromApi(dto, permissions, fields)
  },

  createWorkspace: async (input: WorkspaceInput): Promise<WorkspaceSummary> =>
    workspaceSummaryFromApi(
      await send<WorkspaceDto>('post', path('/workspaces'), workspaceBody(input)),
    ),

  updateWorkspace,

  /** Change Cover: an uploaded image (module projects), or null for the default banner. */
  setCover: async (workspace: Workspace, file: File | null): Promise<void> => {
    const uploaded = file ? await uploadFile(file, 'projects') : null
    await send('put', path(`/workspaces/${workspace.id}/cover`), {
      fileId: uploaded ? toApiId(uploaded.id) : null,
      rowVersion: workspace.rowVersion,
    })
  },

  deleteWorkspace: (workspace: Pick<Workspace, 'id' | 'rowVersion'>) =>
    remove(path(`/workspaces/${workspace.id}`), workspace.rowVersion),

  changeMemberRole: (workspaceId: string, employeeId: string, role: PmRole) =>
    send('patch', path(`/workspaces/${workspaceId}/members/${employeeId}`), {
      memberRole: roleToApi(role),
    }),

  removeMember: (workspaceId: string, employeeId: string) =>
    remove(path(`/workspaces/${workspaceId}/members/${employeeId}`)),

  /** Set Role Permission of one column. Labels needs the workspace's Labels field. */
  saveColumnPermission: async (
    workspace: Workspace,
    key: TaskColumnKey,
    permission: ColumnPermission,
  ): Promise<void> => {
    const apiKey = columnToApi(key, workspace.labelsFieldId)
    if (!apiKey || apiKey === 'name') {
      throw new Error(
        key === 'labels'
          ? 'Add a label first: the Labels column has no field to protect yet.'
          : 'Task Name is always editable.',
      )
    }
    await send(
      'put',
      path(`/workspaces/${workspace.id}/column-permissions/${apiKey}`),
      permissionToApi(permission),
    )
  },

  /** A folder or a list (in a folder or at the top level) in the Workspaces panel. */
  createItem: async (
    workspaceId: string,
    input: { kind: WorkspaceItem['kind']; name: string; parentId: string | null },
  ): Promise<{ id: string; name: string }> =>
    input.kind === 'folder'
      ? send<{ id: string; name: string }>('post', path(`/workspaces/${workspaceId}/folders`), {
          name: input.name,
        })
      : send<{ id: string; name: string }>('post', path(`/workspaces/${workspaceId}/lists`), {
          name: input.name,
          folderId: input.parentId ? toApiId(folderApiId(input.parentId)) : null,
        }),

  // --- tasks ---------------------------------------------------------------------------------

  /** The List view's tasks (all pages), with the caller's favourites marked. */
  tasks: async (
    workspaceId: string,
    listId: string | null,
    signal?: AbortSignal,
  ): Promise<TaskList> => {
    let hiddenColumns: string[] = []
    const [rows, favorites] = await Promise.all([
      getAll<TaskPageDto['data'][number]>(
        path(`/workspaces/${workspaceId}/tasks`),
        { ...(listId ? { listId } : {}), groupBy: 'none', sortBy: 'manual', subtasks: 'expanded' },
        signal,
        (page) => {
          hiddenColumns = page.hiddenColumns ?? []
        },
      ),
      getItem<FavoriteDto[]>(path('/favorites'), { kind: 'favorite' }, signal),
    ])
    const favored = new Set(
      favorites.filter((entry) => entry.entityType === 'task').map((entry) => entry.entityId),
    )
    return { rows: rows.map((row) => taskRowFromApi(row, favored)), hiddenColumns }
  },

  task: async (id: string, signal?: AbortSignal): Promise<TaskDetail> =>
    taskDetailFromApi(await getTaskDto(id, signal)),

  createTask: async (input: TaskInput): Promise<TaskDetail> =>
    taskDetailFromApi(
      await send<TaskDto>('post', path('/tasks'), {
        name: input.name,
        taskType: input.type ?? 'task',
        ...(input.parentId
          ? { parentTaskId: toApiId(input.parentId) }
          : {
              workspaceId: toApiId(input.workspaceId),
              taskListId: input.listId ? toApiId(input.listId) : null,
            }),
        statusId: input.statusId ? toApiId(input.statusId) : null,
      }),
    ),

  updateTask,

  deleteTask: (task: Pick<TaskRow, 'id' | 'rowVersion'>) =>
    remove(path(`/tasks/${task.id}`), task.rowVersion),

  /** Moves a task and its subtasks to another workspace (and list); they keep their IDs. */
  moveTask: async (
    id: string,
    target: { workspaceId: string; listId: string | null },
  ): Promise<TaskDetail> => {
    const current = await getTaskDto(id)
    return taskDetailFromApi(
      await send<TaskDto>('post', path(`/tasks/${id}/move`), {
        workspaceId: toApiId(target.workspaceId),
        taskListId: target.listId ? toApiId(target.listId) : null,
        parentTaskId: null,
        rowVersion: current.rowVersion,
      }),
    )
  },

  /** Convert to List: a list named after the task takes its subtasks; the task goes. */
  convertToList: async (task: Pick<TaskRow, 'id' | 'rowVersion'>): Promise<string> =>
    (
      await send<{ taskListId: string }>('post', path(`/tasks/${task.id}/convert-to-list`), {
        rowVersion: task.rowVersion,
      })
    ).taskListId,

  addDependency: async (
    taskId: string,
    otherTaskId: string,
    kind: 'waiting_on' | 'blocking',
  ): Promise<TaskDetail> =>
    taskDetailFromApi(
      await send<TaskDto>('post', path(`/tasks/${taskId}/dependencies`), {
        otherTaskId: toApiId(otherTaskId),
        kind,
      }),
    ),

  removeDependency: (dependencyId: string) => remove(path(`/dependencies/${dependencyId}`)),

  // --- comments --------------------------------------------------------------------------------

  comments: async (taskId: string, signal?: AbortSignal): Promise<TaskComment[]> =>
    (await getItem<CommentDto[]>(path(`/tasks/${taskId}/comments`), undefined, signal)).map(
      commentFromApi,
    ),

  addComment: async (
    taskId: string,
    input: CommentInput,
    context: MentionContext,
  ): Promise<TaskComment> =>
    commentFromApi(
      await send<CommentDto>('post', path(`/tasks/${taskId}/comments`), {
        body: input.body,
        parentId: input.parentId ? toApiId(input.parentId) : null,
        assignedToId: input.assignedToId ? toApiId(input.assignedToId) : null,
        mentions: mentionsIn(input.body, context),
      }),
    ),

  /** One comment change: its text, assignee, resolved mark or the caller's like. */
  updateComment: async (
    comment: TaskComment,
    patch: CommentPatch,
    context: MentionContext,
  ): Promise<TaskComment> => {
    let dto: CommentDto | null = null
    if (patch.body !== undefined) {
      dto = await send<CommentDto>('put', path(`/comments/${comment.id}`), {
        body: patch.body,
        mentions: mentionsIn(patch.body, context),
        rowVersion: comment.rowVersion,
      })
    }
    if (patch.assignedToId !== undefined) {
      dto = await send<CommentDto>('patch', path(`/comments/${comment.id}/assign`), {
        assignedToId: patch.assignedToId ? toApiId(patch.assignedToId) : null,
      })
    }
    if (patch.resolved !== undefined) {
      dto = await send<CommentDto>('patch', path(`/comments/${comment.id}/resolve`), {
        resolved: patch.resolved,
      })
    }
    if (patch.liked !== undefined) {
      dto = await send<CommentDto>('put', path(`/comments/${comment.id}/reaction`), {
        reaction: patch.liked ? 'like' : null,
      })
    }
    return dto ? commentFromApi(dto) : comment
  },

  deleteComment: (comment: Pick<TaskComment, 'id' | 'rowVersion'>) =>
    remove(path(`/comments/${comment.id}`), comment.rowVersion),

  // --- attachments --------------------------------------------------------------------------------

  attachments: async (taskId: string, signal?: AbortSignal): Promise<Attachment[]> =>
    (await getItem<AttachmentDto[]>(path(`/tasks/${taskId}/attachments`), undefined, signal)).map(
      attachmentFromApi,
    ),

  /** Uploads the file (module projects), then attaches it to the task. */
  addAttachment: async (
    taskId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<Attachment> => {
    const uploaded = await uploadFile(file, 'projects', onProgress)
    return attachmentFromApi(
      await send<AttachmentDto>('post', path(`/tasks/${taskId}/attachments`), {
        fileId: toApiId(uploaded.id),
      }),
    )
  },

  deleteAttachment: (id: string) => remove(path(`/attachments/${id}`)),

  // --- time tracking --------------------------------------------------------------------------------

  timeEntries: async (taskId: string, signal?: AbortSignal): Promise<TimeEntry[]> =>
    (await getItem<TimeEntryDto[]>(path(`/tasks/${taskId}/time-entries`), undefined, signal)).map(
      timeEntryFromApi,
    ),

  addTimeEntry: async (taskId: string, input: TimeEntryInput): Promise<TimeEntry> => {
    const body =
      'minutes' in input
        ? {
            startAt: new Date(Date.now() - input.minutes * 60_000).toISOString(),
            minutes: input.minutes,
            notes: input.notes || null,
          }
        : {
            startAt: new Date(`${input.date}T${input.start}:00`).toISOString(),
            endAt: new Date(`${input.date}T${input.end}:00`).toISOString(),
            notes: input.notes || null,
          }
    return timeEntryFromApi(
      await send<TimeEntryDto>('post', path(`/tasks/${taskId}/time-entries`), body),
    )
  },

  deleteTimeEntry: (id: string) => remove(path(`/time-entries/${id}`)),

  startTimer: async (taskId: string): Promise<TimeEntry> =>
    timeEntryFromApi(await send<TimeEntryDto>('post', path(`/tasks/${taskId}/timer/start`))),

  /** Stops the caller's running timer (on whichever task it runs). */
  stopTimer: async (notes?: string): Promise<TimeEntry> =>
    timeEntryFromApi(
      await send<TimeEntryDto>('post', path('/timer/stop'), { notes: notes ?? null }),
    ),

  // --- reminders ------------------------------------------------------------------------------------

  /** The caller's next reminder on a task, if any. */
  reminder: async (taskId: string, signal?: AbortSignal): Promise<Reminder | null> => {
    const { data } = await apiClient.get<Paginated<ReminderDto>>(path('/reminders'), {
      params: { entityType: 'task', entityId: taskId, pageSize: PAGE_SIZE },
      ...(signal ? { signal } : {}),
    })
    const first = data.data.find((entry) => entry.entityType === 'task')
    return first ? reminderFromApi(first) : null
  },

  /** Remind Me: sets, moves or (null) removes the caller's reminder on a task. */
  setReminder: async (
    task: Pick<TaskRow, 'id' | 'name'>,
    at: Date | null,
    current: Reminder | null,
  ): Promise<void> => {
    if (!at) {
      if (current) await remove(path(`/reminders/${current.id}`))
      return
    }
    const body = {
      entityType: 'task',
      entityId: toApiId(task.id),
      name: task.name.slice(0, 200),
      remindAt: at.toISOString(),
      ...(current ? { rowVersion: current.rowVersion } : {}),
    }
    if (current) await send('put', path(`/reminders/${current.id}`), body)
    else await send('post', path('/reminders'), body)
  },

  // --- tags and labels ---------------------------------------------------------------------------------

  /** The workspace's tags, and the options of its Labels field as labels. */
  tags: async (workspaceId: string, signal?: AbortSignal): Promise<Tag[]> => {
    const [tags, field] = await Promise.all([
      getItem<TagDto[]>(path(`/workspaces/${workspaceId}/tags`), undefined, signal),
      labelsField(workspaceId, signal),
    ])
    return [...tags.map(tagFromApi), ...labelsFromField(field)]
  },

  /** A tag, or a new option of the Labels field (made on the first label). */
  createTag: async (workspaceId: string, input: TagInput): Promise<Tag> => {
    if (input.kind === 'tag') {
      return tagFromApi(
        await send<TagDto>('post', path(`/workspaces/${workspaceId}/tags`), {
          name: input.name,
          color: input.color,
        }),
        0,
      )
    }
    const field = await labelsField(workspaceId)
    const options = field ? labelOptions(field) : []
    const saved = field
      ? await send<CustomFieldDto>('put', path(`/custom-fields/${field.id}`), {
          name: field.name,
          fieldType: 'labels',
          description: field.description,
          config: { ...field.config, options: [...options, input.name] },
          rowVersion: field.rowVersion,
        })
      : await send<CustomFieldDto>('post', path(`/workspaces/${workspaceId}/custom-fields`), {
          name: 'Labels',
          fieldType: 'labels',
          config: { options: [input.name] },
        })
    const created = labelsFromField(saved).find((tag) => tag.name === input.name)
    return created ?? { ...input, id: labelId(saved.id, input.name), workspaceId, rowVersion: null }
  },

  /** Renames or recolours a tag; renames a label option. */
  updateTag: async (tag: Tag, patch: Partial<TagInput>): Promise<void> => {
    if (tag.kind === 'tag') {
      await send('put', path(`/tags/${tag.id}`), {
        name: patch.name ?? tag.name,
        color: patch.color ?? tag.color,
        rowVersion: tag.rowVersion,
      })
      return
    }
    const field = await labelsField(tag.workspaceId)
    if (!field || patch.name === undefined) return
    const { option } = labelParts(tag.id)
    const name = patch.name
    await send('put', path(`/custom-fields/${field.id}`), {
      name: field.name,
      fieldType: 'labels',
      description: field.description,
      config: {
        ...field.config,
        options: labelOptions(field).map((entry) => (entry === option ? name : entry)),
      },
      rowVersion: field.rowVersion,
    })
  },

  deleteTag: async (tag: Tag): Promise<void> => {
    if (tag.kind === 'tag') {
      await remove(path(`/tags/${tag.id}`), tag.rowVersion)
      return
    }
    const field = await labelsField(tag.workspaceId)
    if (!field) return
    const { option } = labelParts(tag.id)
    const options = labelOptions(field).filter((entry) => entry !== option)
    if (options.length === 0) {
      await remove(path(`/custom-fields/${field.id}`), field.rowVersion)
      return
    }
    await send('put', path(`/custom-fields/${field.id}`), {
      name: field.name,
      fieldType: 'labels',
      description: field.description,
      config: { ...field.config, options },
      rowVersion: field.rowVersion,
    })
  },

  // --- sharing ---------------------------------------------------------------------------------------

  share: async (
    entityType: ShareEntity,
    entityId: string,
    signal?: AbortSignal,
  ): Promise<ShareSettings> =>
    shareFromApi(await getItem<ShareDto>(path('/shares'), { entityType, entityId }, signal)),

  saveShare: async (settings: ShareSettings): Promise<ShareSettings> =>
    shareFromApi(await send<ShareDto>('put', path('/shares'), shareToApi(settings))),
}

export const pmKeys = {
  all: ['project-management'] as const,
  templates: () => [...pmKeys.all, 'templates'] as const,
  people: () => [...pmKeys.all, 'people'] as const,
  departments: () => [...pmKeys.all, 'departments'] as const,
  tree: () => [...pmKeys.all, 'tree'] as const,
  workspace: (id: string) => [...pmKeys.all, 'workspace', id] as const,
  tasks: (workspaceId: string, listId: string | null) =>
    [...pmKeys.all, 'tasks', workspaceId, listId ?? 'all'] as const,
  task: (id: string) => [...pmKeys.all, 'task', id] as const,
  comments: (taskId: string) => [...pmKeys.all, 'comments', taskId] as const,
  attachments: (taskId: string) => [...pmKeys.all, 'attachments', taskId] as const,
  timeEntries: (taskId: string) => [...pmKeys.all, 'time-entries', taskId] as const,
  reminder: (taskId: string) => [...pmKeys.all, 'reminder', taskId] as const,
  tags: (workspaceId: string) => [...pmKeys.all, 'tags', workspaceId] as const,
  share: (entityType: ShareEntity, entityId: string) =>
    [...pmKeys.all, 'share', entityType, entityId] as const,
}

export const pmTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: pmKeys.templates(),
    queryFn: ({ signal }) => pmApi.templates(signal),
    staleTime: 10 * 60_000,
  })

export const pmTreeQueryOptions = () =>
  queryOptions({
    queryKey: pmKeys.tree(),
    queryFn: async ({ signal }): Promise<WorkspaceTree> => ({
      workspaces: await pmApi.workspaces(signal),
    }),
  })
