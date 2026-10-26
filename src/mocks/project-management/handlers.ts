import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  ColumnPermissionsDto,
  CommentDto,
  PersonDto,
  TaskDto,
  TaskPageDto,
  TaskRowDto,
  WorkspaceDto,
  WorkspaceSummaryDto,
} from '@/features/project-management/api/pm.dto'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { employeeRef } from '../payroll/engine'
import { conflict, invalid, notFound, ok, readBody, rejected } from '../payroll/http'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import {
  attachments,
  columnPermissions,
  type CommentRecord,
  comments,
  customFields,
  dependencies,
  favorites,
  folders,
  lists,
  reminders,
  shares,
  tags,
  type TaskRecord,
  tasks,
  timeEntries,
  views,
  type WorkspaceRecord,
  workspaces,
} from './db'
import {
  DEPARTMENTS,
  ME,
  ME_USER_ID,
  nextRowVersion,
  STATUS_TEMPLATES,
  WORKFLOW_TEMPLATES,
} from './seed'

/**
 * The mock of the backend's Project Management API (`/api/projects`, backend
 * `app/routers/projects*.py`): the same routes, bodies and answers. The caller is always Shelley
 * Kannes (`em_shelley`); her workspace role in each workspace decides as the backend's does,
 * loosely: the mock refuses only what the screens hide.
 */

/**
 * Names of uploads, so an attachment can show its file's name: the files mock keeps its uploads
 * to itself, so tests (and anything that knows) record them here.
 */
const uploadedNames = new Map<string, { name: string; mimeType: string; size: number }>()

export const rememberUpload = (
  fileId: string,
  file: { name: string; mimeType: string; size: number },
) => {
  uploadedNames.set(fileId, file)
}

const base = (path: string) => apiPath(`/projects${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

/** UTC now, without an offset (as the API writes instants). */
const utcNow = () => new Date().toISOString().slice(0, 19)
/** A sent instant (any ISO) as the API stores it. */
const toUtc = (value: string) => new Date(value).toISOString().slice(0, 19)

const created = (data: unknown) => HttpResponse.json({ data }, { status: 201 })
const noContent = () => new HttpResponse(null, { status: 204 })
const forbidden = (message: string) => errorResponse(403, message, { code: 'FORBIDDEN' })

const param = (params: Record<string, string | readonly string[] | undefined>, name = 'id') =>
  String(params[name] ?? '')

/** Ids arrive as numbers (the real API's) or the mock's strings. */
const id = z.union([z.number(), z.string().min(1)]).transform(String)
const rowVersion = z.string().nullish()

const staleRow = (record: { rowVersion: string }, sent: string | null | undefined) =>
  sent !== undefined && sent !== null && sent !== record.rowVersion

const stale = () =>
  conflict('Someone else changed this record. Reload it and try again', 'CONFLICT')

// --- people, roles ----------------------------------------------------------------------------------

const nameOf = (employeeId: string | null | undefined) =>
  employeeId ? employeeRef(employeeId).name : null

const RANK: Record<string, number> = {
  workspace_admin: 5,
  hr: 4,
  manager: 3,
  team_leader: 2,
  contributor: 1,
}

const roleIn = (workspace: WorkspaceRecord, employeeId = ME) =>
  workspace.members.find((member) => member.employeeId === employeeId)?.memberRole ?? null

const rankIn = (workspace: WorkspaceRecord) => RANK[roleIn(workspace) ?? ''] ?? 0

const canRead = (workspace: WorkspaceRecord) =>
  workspace.privacy !== 'private' || roleIn(workspace) !== null

const readable = (workspaceId: string) => {
  const workspace = workspaces.find(workspaceId)
  return workspace && canRead(workspace) ? workspace : undefined
}

const person = (employeeId: string, memberRole: string | null): PersonDto => {
  const ref = employeeRef(employeeId)
  return {
    id: employeeId,
    code: ref.code,
    name: ref.name,
    designationName: ref.designation || null,
    departmentName: ref.department || null,
    photoFileId: null,
    photoUrl: ref.photoUrl,
    memberRole,
  }
}

// --- shaping: records to the API's answers -------------------------------------------------------------

const isFavorite = (entityType: string, entityId: string) =>
  favorites
    .all()
    .some(
      (entry) =>
        entry.entityType === entityType && entry.entityId === entityId && entry.kind === 'favorite',
    )

function summary(workspace: WorkspaceRecord): WorkspaceSummaryDto {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    privacy: workspace.privacy,
    departmentId: workspace.departmentId,
    departmentName: DEPARTMENTS.find((entry) => entry.id === workspace.departmentId)?.name ?? null,
    ownerId: workspace.ownerId,
    ownerName: nameOf(workspace.ownerId),
    myRole: roleIn(workspace),
    isFavorite: isFavorite('workspace', workspace.id),
    isHidden: false,
    memberCount: workspace.members.length,
    coverFileId: workspace.cover?.id ?? null,
    cover: workspace.cover,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    rowVersion: workspace.rowVersion,
  }
}

const closedGroups = new Set(['done', 'closed'])

function statusOf(task: TaskRecord) {
  const workspace = workspaces.find(task.workspaceId)
  return workspace?.statuses.find((entry) => entry.id === task.statusId)
}

function detail(workspace: WorkspaceRecord): WorkspaceDto {
  const workspaceTasks = tasks.all().filter((task) => task.workspaceId === workspace.id)
  return {
    ...summary(workspace),
    workflowTemplate: workspace.workflowTemplate,
    workflowTemplateName:
      WORKFLOW_TEMPLATES.find((entry) => entry.code === workspace.workflowTemplate)?.name ??
      workspace.workflowTemplate,
    statusMode: workspace.statusMode,
    statusTemplate: workspace.statusTemplate,
    statuses: workspace.statuses,
    features: workspace.features,
    members: workspace.members.map((member) => {
      const ref = employeeRef(member.employeeId)
      return {
        employeeId: member.employeeId,
        name: ref.name,
        designationName: ref.designation || null,
        departmentName: ref.department || null,
        memberRole: member.memberRole,
      }
    }),
    views: views
      .all()
      .filter(
        (view) => view.workspaceId === workspace.id && (!view.isPrivate || view.ownerId === ME),
      )
      .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(({ workspaceId: _workspaceId, ...view }) => view),
    folders: folders
      .all()
      .filter((folder) => folder.workspaceId === workspace.id)
      .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(({ workspaceId: _workspaceId, ...folder }) => folder),
    lists: lists
      .all()
      .filter((list) => list.workspaceId === workspace.id)
      .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(({ workspaceId: _workspaceId, ...list }) => {
        const own = workspaceTasks.filter((task) => task.taskListId === list.id)
        const closed = own.filter((task) => closedGroups.has(statusOf(task)?.statusGroup ?? ''))
        return {
          ...list,
          taskCount: own.length,
          closedCount: closed.length,
          progressPercent: own.length ? Math.round((closed.length / own.length) * 100) : 0,
        }
      }),
  }
}

/** Levels in effect for the caller: their own row, then their role's, then the default. */
function myLevels(workspace: WorkspaceRecord): Record<string, string> {
  const role = roleIn(workspace)
  const out: Record<string, string> = {}
  for (const entry of columnPermissions.all().filter((row) => row.workspaceId === workspace.id)) {
    const level =
      entry.members.find((member) => member.employeeId === ME)?.permissionLevel ??
      entry.roles.find((row) => row.memberRole === role)?.permissionLevel ??
      entry.defaultLevel
    if (level !== 'default') out[entry.columnKey] = level
  }
  return out
}

/** Columns blanked for the caller (Private Field); workspace admins see everything. */
const hiddenFor = (workspace: WorkspaceRecord) =>
  roleIn(workspace) === 'workspace_admin'
    ? []
    : Object.entries(myLevels(workspace))
        .filter(([, level]) => level === 'private')
        .map(([key]) => key)
        .sort()

const COLUMN_FIELDS: Record<string, (keyof TaskRowDto)[]> = {
  assignees: ['assignees'],
  start_date: ['startDate', 'startTime'],
  due_date: ['dueDate', 'dueTime', 'originalDueDate', 'isOverdue', 'recurrence'],
  priority: ['priority'],
  tags: ['tags'],
  dependencies: ['openDependencyCount', 'blockingCount'],
  time_estimate: ['timeEstimateMinutes'],
  time_tracked: ['timeTrackedMinutes'],
  task_id: ['code'],
  created_by: ['createdByUserId', 'createdByName'],
  date_created: ['createdAt'],
  date_closed: ['closedAt'],
  latest_comment: ['latestComment'],
  story_points: ['storyPointsTotal', 'rating'],
  files: ['attachmentCount'],
}

function row(task: TaskRecord, hidden: readonly string[] = []): TaskRowDto {
  const status = statusOf(task)
  const own = comments.all().filter((comment) => comment.taskId === task.id)
  const latest = own.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const subtasks = tasks.all().filter((other) => other.parentTaskId === task.id)
  const waits = dependencies
    .all()
    .filter((entry) => entry.taskId === task.id && entry.kind === 'waiting_on')
  const openWaits = waits.filter((entry) => {
    const other = tasks.find(entry.otherTaskId)
    return other && !closedGroups.has(statusOf(other)?.statusGroup ?? '')
  })
  const blocking = dependencies
    .all()
    .filter((entry) => entry.otherTaskId === task.id && entry.kind === 'waiting_on')
  const tracked = timeEntries
    .all()
    .filter((entry) => entry.taskId === task.id && !entry.isRunning)
    .reduce((sum, entry) => sum + (entry.minutes ?? 0), 0)
  const points = task.assignees.reduce((sum, entry) => sum + (entry.storyPoints ?? 0), 0)
  const today = new Date().toISOString().slice(0, 10)
  const out: TaskRowDto = {
    id: task.id,
    workspaceId: task.workspaceId,
    taskListId: task.taskListId,
    listName: task.taskListId ? (lists.find(task.taskListId)?.name ?? null) : null,
    parentTaskId: task.parentTaskId,
    parentName: task.parentTaskId ? (tasks.find(task.parentTaskId)?.name ?? null) : null,
    code: task.code,
    name: task.name,
    description: task.description,
    taskType: task.taskType,
    statusId: task.statusId,
    statusName: status?.name ?? '',
    statusColor: status?.color ?? null,
    statusGroup: status?.statusGroup ?? 'not_started',
    priority: task.priority,
    startDate: task.startDate,
    startTime: task.startTime,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    originalDueDate: null,
    isOverdue:
      task.dueDate !== null && task.dueDate < today && !closedGroups.has(status?.statusGroup ?? ''),
    timeEstimateMinutes: task.timeEstimateMinutes,
    timeTrackedMinutes: tracked,
    storyPointsTotal: task.assignees.some((entry) => entry.storyPoints !== null) ? points : null,
    rating: task.rating,
    url: task.url,
    recurrence: task.recurrence,
    closedAt: task.closedAt,
    isClosedLate: false,
    sortOrder: task.sortOrder,
    createdByUserId: task.createdByUserId,
    createdByName: task.createdByName,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    subtaskCount: subtasks.length,
    openSubtaskCount: subtasks.filter(
      (other) => !closedGroups.has(statusOf(other)?.statusGroup ?? ''),
    ).length,
    commentCount: own.length,
    attachmentCount: attachments.all().filter((entry) => entry.taskId === task.id).length,
    openDependencyCount: openWaits.length,
    blockingCount: blocking.length,
    checklistCount: 0,
    checklistDoneCount: 0,
    latestComment: latest
      ? { body: latest.body, authorName: nameOf(latest.authorId), createdAt: latest.createdAt }
      : null,
    assignees: task.assignees.map((entry) => ({
      employeeId: entry.employeeId,
      name: employeeRef(entry.employeeId).name,
      storyPoints: entry.storyPoints,
    })),
    tags: task.tagIds
      .map((tagId) => tags.find(tagId))
      .filter((tag) => tag !== undefined)
      .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    fieldValues: task.fieldValues,
    coverFileId: task.cover?.id ?? null,
    cover: task.cover,
    rowVersion: task.rowVersion,
  }
  const blanked = out as unknown as Record<string, unknown>
  for (const key of hidden) {
    if (key.startsWith('cf_')) {
      out.fieldValues = out.fieldValues.filter((value) => `cf_${value.customFieldId}` !== key)
    }
    for (const field of COLUMN_FIELDS[key] ?? []) {
      blanked[field] = field === 'assignees' || field === 'tags' ? [] : null
    }
  }
  return out
}

function taskDetail(task: TaskRecord): TaskDto {
  const workspace = workspaces.find(task.workspaceId)
  const hidden = workspace ? hiddenFor(workspace) : []
  const links = dependencies
    .all()
    .filter((entry) => entry.taskId === task.id || entry.otherTaskId === task.id)
    .flatMap((entry) => {
      const mine = entry.taskId === task.id
      const other = tasks.find(mine ? entry.otherTaskId : entry.taskId)
      if (!other) return []
      const status = statusOf(other)
      return [
        {
          id: entry.id,
          kind: entry.kind === 'linked' ? 'linked' : mine ? 'waiting_on' : 'blocking',
          taskId: other.id,
          code: other.code,
          name: other.name,
          statusName: status?.name ?? '',
          statusColor: status?.color ?? null,
          statusGroup: status?.statusGroup ?? 'not_started',
        },
      ]
    })
  return {
    ...row(task, hidden),
    myRole: workspace ? roleIn(workspace) : null,
    isFavorite: isFavorite('task', task.id),
    dependencies: hidden.includes('dependencies') ? [] : links,
    checklist: [],
    subtasks: [],
    extensions: [],
    hiddenColumns: hidden,
  }
}

const touch = (task: TaskRecord, changes: Partial<TaskRecord>) =>
  tasks.update(task.id, {
    ...task,
    ...changes,
    updatedAt: utcNow(),
    rowVersion: nextRowVersion(),
  }) ?? task

function commentDto(comment: CommentRecord): CommentDto {
  return {
    ...comment,
    authorName: nameOf(comment.authorId) ?? 'Someone',
    assignedToName: nameOf(comment.assignedToId),
    assignedByName: nameOf(comment.assignedById),
    resolvedByName: nameOf(comment.resolvedById),
    replyCount: comments.all().filter((other) => other.parentId === comment.id).length,
  }
}

function nextCode(): string {
  const highest = tasks.all().reduce((max, task) => {
    const number = Number(task.code.replace(/\D/g, ''))
    return Number.isFinite(number) && number > max ? number : max
  }, 0)
  return `HR${String(highest + 1).padStart(9, '0')}`
}

/** A task and every subtask below it. */
function family(taskId: string): Set<string> {
  const ids = new Set([taskId])
  let grew = true
  while (grew) {
    grew = false
    for (const task of tasks.all()) {
      if (task.parentTaskId && ids.has(task.parentTaskId) && !ids.has(task.id)) {
        ids.add(task.id)
        grew = true
      }
    }
  }
  return ids
}

// --- request bodies (backend app/schemas/projects*.py) --------------------------------------------------

const statusGroup = z.enum(['not_started', 'active', 'done', 'closed'])
const role = z.enum(['workspace_admin', 'hr', 'manager', 'team_leader', 'contributor'])
const level = z.enum(['default', 'can_edit', 'can_view', 'private'])
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Choose a time')
  .transform((value) => (value.length === 5 ? `${value}:00` : value))

const statusIn = z.object({
  id: id.nullish(),
  name: z.string().trim().min(1, 'Name the status').max(200),
  color: z.string().max(20).nullish(),
  statusGroup,
  wipLimit: z.number().int().min(1).nullish(),
})

const workspaceCreate = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Use at least 3 characters')
    .max(50, 'Keep the name to 50 characters'),
  description: z.string().max(300, 'Keep the description to 300 characters').nullish(),
  privacy: z.enum(['private', 'workspace', 'public']),
  ownerId: id,
  departmentId: id,
  workflowTemplate: z.string().default('work_starter'),
  statusMode: z.enum(['default', 'custom']).default('default'),
  statusTemplate: z.string().nullish(),
  statuses: z.array(statusIn).nullish(),
  views: z
    .array(z.object({ viewType: z.string(), isDefault: z.boolean().default(false) }))
    .nullish(),
  features: z
    .array(z.object({ featureCode: z.string(), settingValue: z.string().nullish() }))
    .nullish(),
  members: z
    .array(z.object({ employeeId: id, memberRole: role.default('contributor') }))
    .default([]),
})

const workspaceUpdate = workspaceCreate
  .pick({ name: true, description: true, privacy: true, ownerId: true, departmentId: true })
  .extend({ rowVersion })

const viewIn = z.object({
  viewType: z.string(),
  name: z.string().trim().min(1).max(200),
  taskListId: id.nullish(),
  config: z.record(z.string(), z.unknown()).nullish(),
  isPinned: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  isProtected: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  rowVersion,
})

const recurrenceIn = z.object({
  every: z.number().int().min(1).max(365),
  unit: z.enum(['day', 'week', 'month', 'year']),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  ends: z.enum(['never', 'on', 'after']).default('never'),
  endDate: day.nullish(),
  count: z.number().int().min(1).max(1000).nullish(),
})

const taskFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the task name')
    .max(200, 'Keep the name under 200 characters'),
  description: z.string().max(5000).nullish(),
  taskType: z.enum(['task', 'milestone']).default('task'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).nullish(),
  startDate: day.nullish(),
  startTime: time.nullish(),
  dueDate: day.nullish(),
  dueTime: time.nullish(),
  timeEstimateMinutes: z.number().int().min(0).nullish(),
  rating: z.number().int().min(0).max(3).nullish(),
  url: z.string().max(2000).nullish(),
  recurrence: recurrenceIn.nullish(),
})

const taskCreate = taskFields.extend({
  workspaceId: id.nullish(),
  taskListId: id.nullish(),
  parentTaskId: id.nullish(),
  statusId: id.nullish(),
  assigneeIds: z.array(id).default([]),
  tagIds: z.array(id).default([]),
})

const mentionIn = z.object({ employeeId: id.nullish(), taskId: id.nullish() })
const commentBody = z
  .string()
  .trim()
  .min(1, 'Write a comment')
  .max(2000, 'Keep the comment under 2000 characters')

const timeEntryIn = z.object({
  startAt: z.string().min(1),
  endAt: z.string().nullish(),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullish(),
  notes: z.string().max(165, 'Keep notes to 165 characters').nullish(),
  employeeId: id.nullish(),
  rowVersion,
})

const reminderIn = z.object({
  entityType: z.enum(['task', 'task_list', 'workspace']),
  entityId: id,
  name: z.string().max(200).nullish(),
  remindAt: z.string().min(1),
  assigneeId: id.nullish(),
  notifyBeforeMinutes: z.number().int().min(0).nullish(),
  reminderKind: z.enum(['soft', 'hard']).nullish(),
  rowVersion,
})

const SHARE_PROPERTIES = [
  'task_name_status',
  'assignee',
  'priority',
  'due_date',
  'description',
  'comments',
  'attachments',
  'custom_fields',
  'subtasks',
  'tags',
  'checklists',
  'cover_image',
] as const

const shareIn = z.object({
  entityType: z.enum(['task', 'task_list', 'workspace']),
  entityId: id,
  shareScope: z.enum(['list', 'page']).default('list'),
  isPublic: z.boolean().default(false),
  allowOpenTasks: z.boolean().default(true),
  validFrom: z.string().nullish(),
  validTo: z.string().nullish(),
  maxAccess: z.number().int().min(1).nullish(),
  properties: z.array(z.enum(SHARE_PROPERTIES)).nullish(),
  members: z
    .array(
      z.object({
        employeeId: id.nullish(),
        email: z.email('Enter a valid email').nullish(),
        accessLevel: z.enum(['full_edit', 'limited', 'commenter']),
      }),
    )
    .default([]),
  rowVersion,
})

const taskOf = (taskId: string) => {
  const task = tasks.find(taskId)
  return task && readable(task.workspaceId) ? task : undefined
}

// --- handlers -------------------------------------------------------------------------------------------

export const projectManagementHandlers = [
  // Departments for Define Workflow (organisation lookups; the PM mock serves the one it needs).
  http.get(apiPath('/organisation/lookups/departments'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok(DEPARTMENTS)
  }),

  http.get(base('/templates'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const kind = new URL(request.url).searchParams.get('kind') ?? 'workflow'
    return ok(kind === 'status' ? STATUS_TEMPLATES : WORKFLOW_TEMPLATES)
  }),

  http.get(base('/people'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const workspaceId = url.searchParams.get('workspaceId')
    const workspace = workspaceId ? workspaces.find(workspaceId) : undefined
    const people = (
      workspace
        ? workspace.members.map((member) => person(member.employeeId, member.memberRole))
        : DIRECTORY.map((employee) => person(employee.id, null))
    ).filter(
      (entry) =>
        !q ||
        entry.name.toLowerCase().includes(q) ||
        (entry.departmentName ?? '').toLowerCase().includes(q),
    )
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(people, page, pageSize))
  }),

  // --- workspaces ---------------------------------------------------------------------------------

  http.get(base('/workspaces'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const onlyFavorites = url.searchParams.get('favorites') === 'true'
    const visible = workspaces
      .all()
      .filter(canRead)
      .filter((workspace) => !q || workspace.name.toLowerCase().includes(q))
      .filter((workspace) => !onlyFavorites || isFavorite('workspace', workspace.id))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map(summary)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(visible, page, pageSize))
  }),

  http.post(base('/workspaces'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, workspaceCreate)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (workspaces.all().some((entry) => entry.name.toLowerCase() === input.name.toLowerCase())) {
      return conflict('A workspace with this name already exists.', 'WORKSPACE_DUPLICATE', {
        name: 'A workspace with this name already exists.',
      })
    }
    if (!findEmployee(input.ownerId))
      return invalid('Owner not found.', { ownerId: 'Owner not found.' })
    if (!DEPARTMENTS.some((entry) => entry.id === input.departmentId)) {
      return invalid('Department not found.', { departmentId: 'Department not found.' })
    }
    const template = WORKFLOW_TEMPLATES.find((entry) => entry.code === input.workflowTemplate)
    if (!template)
      return invalid('Workflow template not found.', { workflowTemplate: 'Not found.' })
    const statusList = input.statuses ?? template.statuses.map((entry) => ({ ...entry, id: null }))
    if (!statusList.some((entry) => entry.statusGroup === 'not_started')) {
      return invalid('Keep at least one Not Started status.', {
        statuses: 'Add a Not Started status.',
      })
    }
    if (!statusList.some((entry) => closedGroups.has(entry.statusGroup))) {
      return invalid('Keep at least one Done or Closed status.', {
        statuses: 'Add a Done or Closed status.',
      })
    }
    const workspaceId = createId('ws')
    // The owner and the creator (when an employee) become workspace admins.
    const members = new Map<string, string>()
    for (const member of input.members) {
      if (!findEmployee(member.employeeId)) {
        return invalid('A member was not found.', { members: 'A member was not found.' })
      }
      members.set(member.employeeId, member.memberRole)
    }
    if (
      input.privacy === 'private' &&
      ![...members.keys()].some((employeeId) => employeeId !== input.ownerId && employeeId !== ME)
    ) {
      return invalid('A private workspace needs at least one invited member.', {
        members: 'A private workspace needs at least one invited member.',
      })
    }
    members.set(input.ownerId, 'workspace_admin')
    members.set(ME, 'workspace_admin')
    const record: WorkspaceRecord = {
      id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      privacy: input.privacy,
      departmentId: input.departmentId,
      ownerId: input.ownerId,
      workflowTemplate: template.code,
      statusMode: input.statusMode,
      statusTemplate: input.statusTemplate ?? null,
      statuses: statusList.map((entry, index) => ({
        id: createId('st'),
        name: entry.name,
        color: entry.color ?? null,
        statusGroup: entry.statusGroup,
        sortOrder: (index + 1) * 10,
        wipLimit: null,
      })),
      features: (input.features ?? template.features).map((entry) => ({
        featureCode: entry.featureCode,
        settingValue: 'settingValue' in entry ? (entry.settingValue ?? null) : null,
      })),
      members: [...members].map(([employeeId, memberRole]) => ({ employeeId, memberRole })),
      cover: null,
      createdAt: utcNow(),
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    workspaces.insert(record)
    const viewList = input.views ?? template.views
    const hasDefault = viewList.some((entry) => entry.isDefault)
    viewList.forEach((entry, index) => {
      views.insert({
        id: createId('vw'),
        workspaceId,
        taskListId: null,
        viewType: entry.viewType,
        name:
          entry.viewType === 'mind_map'
            ? 'Mind Map'
            : `${entry.viewType.charAt(0).toUpperCase()}${entry.viewType.slice(1)}`,
        config: null,
        isPinned: false,
        isPrivate: false,
        isProtected: false,
        isDefault: hasDefault ? entry.isDefault : entry.viewType === 'list',
        isRequired: entry.viewType === 'list',
        sortOrder: (index + 1) * 10,
        ownerId: null,
        rowVersion: nextRowVersion(),
      })
    })
    if (!canRead(record)) return notFound('workspace')
    return created(detail(record))
  }),

  http.get(base('/workspaces/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return errorResponse(404, 'Workspace not found', { code: 'NOT_FOUND' })
    return ok(detail(workspace))
  }),

  http.put(base('/workspaces/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 4)
      return forbidden('Only workspace admins and HR can edit the workspace.')
    const parsed = await readBody(request, workspaceUpdate)
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(workspace, parsed.data.rowVersion)) return stale()
    const { rowVersion: _rowVersion, ...rest } = parsed.data
    const next = {
      ...workspace,
      ...rest,
      description: rest.description ?? null,
      updatedAt: utcNow(),
      rowVersion: nextRowVersion(),
    }
    return ok(detail(workspaces.update(workspace.id, next) ?? next))
  }),

  http.put(base('/workspaces/:id/cover'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 4)
      return forbidden('Only workspace admins and HR can change the cover.')
    const parsed = await readBody(
      request,
      z.object({ fileId: id.nullish(), rowVersion: z.string() }),
    )
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(workspace, parsed.data.rowVersion)) return stale()
    const fileId = parsed.data.fileId ?? null
    const next = {
      ...workspace,
      cover: fileId ? { id: fileId, name: 'cover', url: mockFileUrl(fileId) } : null,
      rowVersion: nextRowVersion(),
    }
    return ok(detail(workspaces.update(workspace.id, next) ?? next))
  }),

  http.delete(base('/workspaces/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 5) return forbidden('Only workspace admins can delete the workspace.')
    for (const task of tasks.all().filter((entry) => entry.workspaceId === workspace.id)) {
      tasks.remove(task.id)
    }
    workspaces.remove(workspace.id)
    return noContent()
  }),

  // --- members ------------------------------------------------------------------------------------

  http.get(base('/workspaces/:id/members'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    return ok(detail(workspace).members)
  }),

  http.post(base('/workspaces/:id/members'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 4) return forbidden('Only workspace admins and HR can add members.')
    const parsed = await readBody(
      request,
      z.object({
        members: z
          .array(z.object({ employeeId: id, memberRole: role.default('contributor') }))
          .min(1, 'Choose at least one person'),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const members = [...workspace.members]
    for (const member of parsed.data.members) {
      if (!findEmployee(member.employeeId)) return invalid('Employee not found.')
      if (!members.some((entry) => entry.employeeId === member.employeeId)) members.push(member)
    }
    const next = { ...workspace, members, rowVersion: nextRowVersion() }
    workspaces.update(workspace.id, next)
    return ok(detail(next).members)
  }),

  http.patch(base('/workspaces/:id/members/:employeeId'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    const parsed = await readBody(request, z.object({ memberRole: role }))
    if (!parsed.success) return rejected(parsed.error)
    const employeeId = param(params, 'employeeId')
    const next = {
      ...workspace,
      members: workspace.members.map((member) =>
        member.employeeId === employeeId
          ? { ...member, memberRole: parsed.data.memberRole }
          : member,
      ),
    }
    workspaces.update(workspace.id, next)
    return ok(detail(next).members)
  }),

  http.delete(base('/workspaces/:id/members/:employeeId'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    const employeeId = param(params, 'employeeId')
    if (employeeId === workspace.ownerId) return invalid('The owner stays a workspace admin.')
    workspaces.update(workspace.id, {
      ...workspace,
      members: workspace.members.filter((member) => member.employeeId !== employeeId),
    })
    return noContent()
  }),

  // --- column permissions, custom fields -------------------------------------------------------------

  http.get(base('/workspaces/:id/column-permissions'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    const body: ColumnPermissionsDto = {
      columns: columnPermissions
        .all()
        .filter((entry) => entry.workspaceId === workspace.id)
        .map((entry) => ({
          columnKey: entry.columnKey,
          defaultLevel: entry.defaultLevel,
          roles: entry.roles,
          members: entry.members.map((member) => ({
            ...member,
            employeeName: nameOf(member.employeeId),
          })),
        })),
      myLevels: myLevels(workspace),
    }
    return ok(body)
  }),

  http.put(base('/workspaces/:id/column-permissions/:key'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 4)
      return forbidden('Only workspace admins and HR can set column permissions.')
    const columnKey = param(params, 'key')
    if (columnKey === 'name') return invalid('Task Name cannot be restricted.')
    const parsed = await readBody(
      request,
      z.object({
        defaultLevel: level.default('default'),
        roles: z.array(z.object({ memberRole: role, permissionLevel: level })).default([]),
        members: z.array(z.object({ employeeId: id, permissionLevel: level })).default([]),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const existing = columnPermissions
      .all()
      .find((entry) => entry.workspaceId === workspace.id && entry.columnKey === columnKey)
    const record = {
      id: existing?.id ?? createId('cp'),
      workspaceId: workspace.id,
      columnKey,
      defaultLevel: parsed.data.defaultLevel,
      roles: parsed.data.roles.filter((entry) => entry.permissionLevel !== 'default'),
      members: parsed.data.members.filter((entry) => entry.permissionLevel !== 'default'),
    }
    if (existing) columnPermissions.update(existing.id, record)
    else columnPermissions.insert(record)
    const body: ColumnPermissionsDto = {
      columns: columnPermissions
        .all()
        .filter((entry) => entry.workspaceId === workspace.id)
        .map((entry) => ({
          columnKey: entry.columnKey,
          defaultLevel: entry.defaultLevel,
          roles: entry.roles,
          members: entry.members.map((member) => ({
            ...member,
            employeeName: nameOf(member.employeeId),
          })),
        })),
      myLevels: myLevels(workspace),
    }
    return ok(body)
  }),

  http.get(base('/workspaces/:id/custom-fields'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = param(params)
    if (!readable(workspaceId)) return notFound('workspace')
    return ok(customFields.all().filter((field) => field.workspaceId === workspaceId))
  }),

  http.post(base('/workspaces/:id/custom-fields'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    const parsed = await readBody(
      request,
      z.object({
        name: z.string().trim().min(1).max(200),
        fieldType: z.string(),
        description: z.string().max(1000).nullish(),
        config: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const field = {
      id: createId('fld'),
      workspaceId: workspace.id,
      name: parsed.data.name,
      fieldType: parsed.data.fieldType,
      description: parsed.data.description ?? null,
      config: parsed.data.config ?? null,
      sortOrder: 10,
      rowVersion: nextRowVersion(),
    }
    return created(customFields.insert(field))
  }),

  http.put(base('/custom-fields/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const field = customFields.find(param(params))
    if (!field) return notFound('custom field')
    const parsed = await readBody(
      request,
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(1000).nullish(),
        config: z.record(z.string(), z.unknown()).nullish(),
        rowVersion,
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(field, parsed.data.rowVersion)) return stale()
    const options = Array.isArray(parsed.data.config?.options) ? parsed.data.config.options : null
    if (
      options &&
      new Set(options.map((option) => String(option).toLowerCase())).size !== options.length
    ) {
      return invalid('Duplicate options are not allowed.', {
        config: 'Duplicate options are not allowed.',
      })
    }
    const next = {
      ...field,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      config: parsed.data.config ?? null,
      rowVersion: nextRowVersion(),
    }
    // Values of a removed option go with it.
    if (options) {
      for (const task of tasks.all()) {
        const value = task.fieldValues.find((entry) => entry.customFieldId === field.id)
        if (!value?.fieldValue) continue
        const kept = (JSON.parse(value.fieldValue) as string[]).filter((option) =>
          options.includes(option),
        )
        tasks.update(task.id, {
          ...task,
          fieldValues: task.fieldValues.map((entry) =>
            entry.customFieldId === field.id
              ? { ...entry, fieldValue: JSON.stringify(kept) }
              : entry,
          ),
        })
      }
    }
    return ok(customFields.update(field.id, next))
  }),

  http.delete(base('/custom-fields/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const field = customFields.find(param(params))
    if (!field) return notFound('custom field')
    customFields.remove(field.id)
    for (const task of tasks.all()) {
      if (task.fieldValues.some((entry) => entry.customFieldId === field.id)) {
        tasks.update(task.id, {
          ...task,
          fieldValues: task.fieldValues.filter((entry) => entry.customFieldId !== field.id),
        })
      }
    }
    return noContent()
  }),

  // --- folders, lists, views -------------------------------------------------------------------------

  http.post(base('/workspaces/:id/folders'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 3) return forbidden('Only managers and above can manage folders.')
    const parsed = await readBody(request, z.object({ name: z.string().trim().min(1).max(200) }))
    if (!parsed.success) return rejected(parsed.error)
    const folder = folders.insert({
      id: createId('fd'),
      workspaceId: workspace.id,
      name: parsed.data.name,
      sortOrder: folders.all().length * 10 + 100,
      rowVersion: nextRowVersion(),
    })
    const { workspaceId: _workspaceId, ...body } = folder
    return created(body)
  }),

  http.post(base('/workspaces/:id/lists'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 3) return forbidden('Only managers and above can manage lists.')
    const parsed = await readBody(
      request,
      z.object({ name: z.string().trim().min(1).max(200), folderId: id.nullish() }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const folderId = parsed.data.folderId ?? null
    if (folderId && folders.find(folderId)?.workspaceId !== workspace.id) {
      return invalid('Folder not found.', { folderId: 'Folder not found.' })
    }
    const list = lists.insert({
      id: createId('ls'),
      workspaceId: workspace.id,
      folderId,
      name: parsed.data.name,
      privacy: 'workspace',
      color: null,
      description: null,
      startAt: null,
      endAt: null,
      priority: null,
      sortOrder: lists.all().length * 10 + 100,
      lastModifiedAt: null,
      memberIds: [],
      rowVersion: nextRowVersion(),
    })
    const { workspaceId: _workspaceId, ...body } = list
    return created({ ...body, taskCount: 0, closedCount: 0, progressPercent: 0 })
  }),

  http.post(base('/workspaces/:id/views'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (!roleIn(workspace)) return forbidden('Only workspace members can keep views.')
    const parsed = await readBody(request, viewIn)
    if (!parsed.success) return rejected(parsed.error)
    if (!parsed.data.isPrivate && rankIn(workspace) < 4) {
      return forbidden('Only workspace admins and HR can add shared views.')
    }
    const { rowVersion: _rowVersion, taskListId, ...rest } = parsed.data
    const view = views.insert({
      ...rest,
      id: createId('vw'),
      workspaceId: workspace.id,
      taskListId: taskListId ?? null,
      config: rest.config ?? null,
      isRequired: false,
      sortOrder: views.all().length * 10 + 100,
      ownerId: rest.isPrivate ? ME : null,
      rowVersion: nextRowVersion(),
    })
    const { workspaceId: _workspaceId, ...body } = view
    return created(body)
  }),

  http.put(base('/views/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const view = views.find(param(params))
    const workspace = view ? readable(view.workspaceId) : undefined
    if (!view || !workspace) return notFound('view')
    const parsed = await readBody(request, viewIn)
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(view, parsed.data.rowVersion)) return stale()
    if (!view.isPrivate && rankIn(workspace) < 4) {
      return forbidden('Only workspace admins and HR can change shared views.')
    }
    const { rowVersion: _rowVersion, taskListId, ...rest } = parsed.data
    const next = {
      ...view,
      ...rest,
      taskListId: taskListId ?? null,
      config: rest.config ?? null,
      rowVersion: nextRowVersion(),
    }
    views.update(view.id, next)
    const { workspaceId: _workspaceId, ...body } = next
    return ok(body)
  }),

  // --- favourites, tags -------------------------------------------------------------------------------

  http.get(base('/favorites'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const kind = new URL(request.url).searchParams.get('kind') ?? 'favorite'
    return ok(
      favorites
        .all()
        .filter((entry) => entry.kind === kind)
        .map((entry) => ({
          ...entry,
          name:
            entry.entityType === 'task'
              ? (tasks.find(entry.entityId)?.name ?? '')
              : (workspaces.find(entry.entityId)?.name ?? ''),
          workspaceId:
            entry.entityType === 'task'
              ? (tasks.find(entry.entityId)?.workspaceId ?? '')
              : entry.entityId,
        })),
    )
  }),

  http.put(base('/favorites'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(
      request,
      z.object({
        entityType: z.enum(['workspace', 'folder', 'task_list', 'task']),
        entityId: id,
        kind: z.enum(['favorite', 'hidden']).default('favorite'),
        on: z.boolean().default(true),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const { entityType, entityId, kind, on } = parsed.data
    const existing = favorites
      .all()
      .find(
        (entry) =>
          entry.entityType === entityType && entry.entityId === entityId && entry.kind === kind,
      )
    if (on && !existing) {
      favorites.insert({ id: createId('fav'), entityType, entityId, kind, createdAt: utcNow() })
    }
    if (!on && existing) favorites.remove(existing.id)
    return noContent()
  }),

  http.get(base('/workspaces/:id/tags'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = param(params)
    if (!readable(workspaceId)) return notFound('workspace')
    return ok(
      tags
        .all()
        .filter((tag) => tag.workspaceId === workspaceId)
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map((tag) => ({
          ...tag,
          taskCount: tasks.all().filter((task) => task.tagIds.includes(tag.id)).length,
        })),
    )
  }),

  http.post(base('/workspaces/:id/tags'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    if (rankIn(workspace) < 2) return forbidden('Only team leaders and above can manage tags.')
    const parsed = await readBody(
      request,
      z.object({
        name: z.string().trim().min(1, 'Enter a name').max(25, 'Keep the name to 25 characters'),
        color: z.string().max(20).nullish(),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const taken = tags
      .all()
      .some(
        (tag) =>
          tag.workspaceId === workspace.id &&
          tag.name.toLowerCase() === parsed.data.name.toLowerCase(),
      )
    if (taken) {
      return conflict('A tag with this name already exists.', 'TAG_DUPLICATE', {
        name: 'A tag with this name already exists.',
      })
    }
    const tag = tags.insert({
      id: createId('tg'),
      workspaceId: workspace.id,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      rowVersion: nextRowVersion(),
    })
    return created({ ...tag, taskCount: 0 })
  }),

  http.put(base('/tags/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const tag = tags.find(param(params))
    if (!tag) return notFound('tag')
    const parsed = await readBody(
      request,
      z.object({
        name: z.string().trim().min(1).max(25, 'Keep the name to 25 characters'),
        color: z.string().max(20).nullish(),
        rowVersion,
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(tag, parsed.data.rowVersion)) return stale()
    const next = {
      ...tag,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      rowVersion: nextRowVersion(),
    }
    tags.update(tag.id, next)
    return ok({
      ...next,
      taskCount: tasks.all().filter((task) => task.tagIds.includes(tag.id)).length,
    })
  }),

  http.delete(base('/tags/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const tagId = param(params)
    if (!tags.find(tagId)) return notFound('tag')
    tags.remove(tagId)
    for (const task of tasks.all().filter((entry) => entry.tagIds.includes(tagId))) {
      tasks.update(task.id, { ...task, tagIds: task.tagIds.filter((other) => other !== tagId) })
    }
    return noContent()
  }),

  // --- tasks ---------------------------------------------------------------------------------------

  http.get(base('/workspaces/:id/tasks'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspace = readable(param(params))
    if (!workspace) return notFound('workspace')
    const url = new URL(request.url)
    const listId = url.searchParams.get('listId')
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const hidden = hiddenFor(workspace)
    const all = tasks
      .all()
      .filter((task) => task.workspaceId === workspace.id)
      .filter((task) => !listId || task.taskListId === listId)
      .filter(
        (task) => !q || task.name.toLowerCase().includes(q) || task.code.toLowerCase().includes(q),
      )
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((task) => row(task, hidden))
    const { page, pageSize } = readPageParams(url)
    const body: TaskPageDto = {
      ...paginate(all, page, pageSize),
      groups: [],
      hiddenColumns: hidden,
    }
    return HttpResponse.json(body)
  }),

  http.post(base('/tasks'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, taskCreate)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const parent = input.parentTaskId ? taskOf(input.parentTaskId) : undefined
    if (input.parentTaskId && !parent)
      return invalid('Parent task not found.', { parentTaskId: 'Not found.' })
    const workspaceId = parent?.workspaceId ?? input.workspaceId
    if (!workspaceId) return invalid('Give the workspace or the parent task.')
    const workspace = readable(workspaceId)
    if (!workspace) return notFound('workspace')
    if (!parent && rankIn(workspace) < 2) {
      return forbidden(
        'Only team leaders and above add tasks. Contributors may add subtasks to tasks assigned to them.',
      )
    }
    const statusId = input.statusId ?? workspace.statuses[0]?.id ?? ''
    if (!workspace.statuses.some((entry) => entry.id === statusId)) {
      return invalid('That status is not in this workspace.', {
        statusId: 'Not in this workspace.',
      })
    }
    const taskListId = parent ? parent.taskListId : (input.taskListId ?? null)
    const closed = closedGroups.has(
      workspace.statuses.find((entry) => entry.id === statusId)?.statusGroup ?? '',
    )
    const task = tasks.insert({
      id: createId('tk'),
      workspaceId,
      taskListId,
      parentTaskId: parent?.id ?? null,
      code: nextCode(),
      name: input.name,
      description: input.description ?? null,
      taskType: input.taskType,
      statusId,
      priority: input.priority ?? null,
      startDate: input.startDate ?? null,
      startTime: input.startTime ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      timeEstimateMinutes: input.timeEstimateMinutes ?? null,
      rating: input.rating ?? null,
      url: input.url ?? null,
      recurrence: input.recurrence
        ? {
            ...input.recurrence,
            endDate: input.recurrence.endDate ?? null,
            count: input.recurrence.count ?? null,
          }
        : null,
      closedAt: closed ? utcNow() : null,
      sortOrder: Math.max(0, ...tasks.all().map((entry) => entry.sortOrder)) + 10,
      createdByUserId: ME_USER_ID,
      createdByName: 'Shelley Kannes',
      createdAt: utcNow(),
      updatedAt: null,
      assignees: input.assigneeIds.map((employeeId) => ({ employeeId, storyPoints: null })),
      tagIds: input.tagIds,
      fieldValues: [],
      cover: null,
      rowVersion: nextRowVersion(),
    })
    return created(taskDetail(task))
  }),

  http.get(base('/tasks/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return errorResponse(404, 'Task not found', { code: 'NOT_FOUND' })
    return ok(taskDetail(task))
  }),

  http.put(base('/tasks/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, taskFields.extend({ rowVersion }))
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(task, parsed.data.rowVersion)) return stale()
    const input = parsed.data
    if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
      return invalid('The due date cannot be before the start date.', {
        dueDate: 'The due date cannot be before the start date.',
      })
    }
    const next = touch(task, {
      name: input.name,
      description: input.description ?? null,
      taskType: input.taskType,
      priority: input.priority ?? null,
      startDate: input.startDate ?? null,
      startTime: input.startTime ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      timeEstimateMinutes: input.timeEstimateMinutes ?? null,
      rating: input.rating ?? null,
      url: input.url ?? null,
      recurrence: input.recurrence
        ? {
            ...input.recurrence,
            endDate: input.recurrence.endDate ?? null,
            count: input.recurrence.count ?? null,
          }
        : null,
    })
    return ok(taskDetail(next))
  }),

  http.delete(base('/tasks/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const sent = new URL(request.url).searchParams.get('rowVersion')
    if (!sent) return invalid('rowVersion is required.', { rowVersion: 'Required.' })
    if (staleRow(task, sent)) return stale()
    const doomed = family(task.id)
    for (const taskId of doomed) tasks.remove(taskId)
    for (const entry of dependencies.all()) {
      if (doomed.has(entry.taskId) || doomed.has(entry.otherTaskId)) dependencies.remove(entry.id)
    }
    for (const comment of comments.all().filter((entry) => doomed.has(entry.taskId))) {
      comments.remove(comment.id)
    }
    return noContent()
  }),

  http.patch(base('/tasks/:id/status'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, z.object({ statusId: id, rowVersion }))
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(task, parsed.data.rowVersion)) return stale()
    const workspace = workspaces.find(task.workspaceId)
    const status = workspace?.statuses.find((entry) => entry.id === parsed.data.statusId)
    if (!status) return invalid('That status is not in this workspace.', { statusId: 'Not found.' })
    const closed = closedGroups.has(status.statusGroup)
    const blocked = dependencies.all().some((entry) => {
      if (entry.taskId !== task.id || entry.kind !== 'waiting_on') return false
      const other = tasks.find(entry.otherTaskId)
      return other && !closedGroups.has(statusOf(other)?.statusGroup ?? '')
    })
    if (closed && blocked) {
      return invalid('This task waits on unfinished tasks and cannot be completed yet.')
    }
    return ok(
      taskDetail(
        touch(task, {
          statusId: status.id,
          closedAt: closed ? (task.closedAt ?? utcNow()) : null,
        }),
      ),
    )
  }),

  http.put(base('/tasks/:id/assignees'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(
      request,
      z.object({
        assignees: z.array(
          z.object({ employeeId: id, storyPoints: z.number().int().min(0).max(100).nullish() }),
        ),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const workspace = workspaces.find(task.workspaceId)
    for (const entry of parsed.data.assignees) {
      if (!workspace?.members.some((member) => member.employeeId === entry.employeeId)) {
        return invalid('Assignees must be members of the workspace.', {
          assignees: 'Assignees must be members of the workspace.',
        })
      }
    }
    return ok(
      taskDetail(
        touch(task, {
          assignees: parsed.data.assignees.map((entry) => ({
            employeeId: entry.employeeId,
            storyPoints: entry.storyPoints ?? null,
          })),
        }),
      ),
    )
  }),

  http.put(base('/tasks/:id/tags'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, z.object({ tagIds: z.array(id) }))
    if (!parsed.success) return rejected(parsed.error)
    if (parsed.data.tagIds.some((tagId) => tags.find(tagId)?.workspaceId !== task.workspaceId)) {
      return invalid('Tag not found in this workspace.')
    }
    return ok(taskDetail(touch(task, { tagIds: [...new Set(parsed.data.tagIds)] })))
  }),

  http.put(base('/tasks/:id/fields/:fieldId'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const field = customFields.find(param(params, 'fieldId'))
    if (field?.workspaceId !== task.workspaceId) return notFound('custom field')
    const parsed = await readBody(
      request,
      z.object({
        value: z
          .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
          .nullish(),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const value = parsed.data.value
    const text =
      value === null || value === undefined
        ? null
        : Array.isArray(value)
          ? JSON.stringify(value.map(String))
          : String(value)
    const fieldValues = [
      ...task.fieldValues.filter((entry) => entry.customFieldId !== field.id),
      ...(text === null ? [] : [{ customFieldId: field.id, fieldValue: text }]),
    ]
    return ok(taskDetail(touch(task, { fieldValues })))
  }),

  http.post(base('/tasks/:id/move'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(
      request,
      z.object({
        workspaceId: id.nullish(),
        taskListId: id.nullish(),
        parentTaskId: id.nullish(),
        sortOrder: z.number().int().nullish(),
        rowVersion,
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(task, parsed.data.rowVersion)) return stale()
    const tree = family(task.id)
    let workspaceId = parsed.data.workspaceId ?? task.workspaceId
    let taskListId = parsed.data.taskListId ?? null
    const parentTaskId = parsed.data.parentTaskId ?? null
    if (parentTaskId) {
      const parent = taskOf(parentTaskId)
      if (!parent)
        return invalid('Parent task not found.', { parentTaskId: 'Parent task not found.' })
      if (tree.has(parentTaskId)) {
        return invalid('A task cannot sit under itself or one of its own subtasks.', {
          parentTaskId: 'A task cannot sit under itself or one of its own subtasks.',
        })
      }
      workspaceId = parent.workspaceId
      taskListId = parent.taskListId
    }
    const target = readable(workspaceId)
    if (!target) return invalid('Workspace not found.', { workspaceId: 'Workspace not found.' })
    if (taskListId && lists.find(taskListId)?.workspaceId !== target.id) {
      return invalid('List not found in that workspace.', {
        taskListId: 'List not found in that workspace.',
      })
    }
    const moving = workspaceId !== task.workspaceId
    for (const taskId of tree) {
      const entry = tasks.find(taskId)
      if (!entry) continue
      const group = statusOf(entry)?.statusGroup
      const status = moving
        ? (target.statuses.find((other) => other.statusGroup === group) ??
          target.statuses.find((other) => other.statusGroup === 'not_started'))
        : undefined
      tasks.update(taskId, {
        ...entry,
        workspaceId,
        taskListId,
        parentTaskId: taskId === task.id ? parentTaskId : entry.parentTaskId,
        statusId: status?.id ?? entry.statusId,
        tagIds: moving ? [] : entry.tagIds,
        fieldValues: moving ? [] : entry.fieldValues,
        assignees: moving
          ? entry.assignees.filter((assignee) =>
              target.members.some((member) => member.employeeId === assignee.employeeId),
            )
          : entry.assignees,
        sortOrder:
          taskId === task.id
            ? (parsed.data.sortOrder ??
              (moving
                ? Math.max(0, ...tasks.all().map((other) => other.sortOrder)) + 10
                : entry.sortOrder))
            : entry.sortOrder,
        updatedAt: utcNow(),
        rowVersion: nextRowVersion(),
      })
    }
    if (moving) {
      for (const entry of dependencies.all()) {
        if (tree.has(entry.taskId) !== tree.has(entry.otherTaskId)) dependencies.remove(entry.id)
      }
    }
    const moved = tasks.find(task.id)
    return moved ? ok(taskDetail(moved)) : notFound('task')
  }),

  http.post(base('/tasks/:id/convert-to-list'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, z.object({ rowVersion }))
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(task, parsed.data.rowVersion)) return stale()
    const folderId = task.taskListId ? (lists.find(task.taskListId)?.folderId ?? null) : null
    const list = lists.insert({
      id: createId('ls'),
      workspaceId: task.workspaceId,
      folderId,
      name: task.name.slice(0, 200),
      privacy: 'workspace',
      color: null,
      description: null,
      startAt: null,
      endAt: null,
      priority: null,
      sortOrder: lists.all().length * 10 + 100,
      lastModifiedAt: null,
      memberIds: [],
      rowVersion: nextRowVersion(),
    })
    const tree = family(task.id)
    for (const taskId of tree) {
      const entry = tasks.find(taskId)
      if (!entry || taskId === task.id) continue
      tasks.update(taskId, {
        ...entry,
        taskListId: list.id,
        parentTaskId: entry.parentTaskId === task.id ? null : entry.parentTaskId,
        rowVersion: nextRowVersion(),
      })
    }
    tasks.remove(task.id)
    for (const entry of dependencies.all()) {
      if (entry.taskId === task.id || entry.otherTaskId === task.id) dependencies.remove(entry.id)
    }
    return ok({ taskListId: list.id })
  }),

  http.post(base('/tasks/:id/dependencies'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(
      request,
      z.object({ otherTaskId: id, kind: z.enum(['waiting_on', 'blocking', 'linked']) }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const other = taskOf(parsed.data.otherTaskId)
    if (!other || other.id === task.id)
      return invalid('Choose another task.', { otherTaskId: 'Choose another task.' })
    const [waits, on] = parsed.data.kind === 'blocking' ? [other.id, task.id] : [task.id, other.id]
    const exists = dependencies
      .all()
      .some(
        (entry) =>
          (entry.taskId === waits && entry.otherTaskId === on) ||
          (entry.taskId === on && entry.otherTaskId === waits),
      )
    if (exists) return conflict('These tasks are already linked.', 'DEPENDENCY_DUPLICATE')
    dependencies.insert({
      id: createId('dep'),
      taskId: waits,
      otherTaskId: on,
      kind: parsed.data.kind === 'linked' ? 'linked' : 'waiting_on',
    })
    return ok(taskDetail(tasks.find(task.id) ?? task))
  }),

  http.delete(base('/dependencies/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    if (!dependencies.remove(param(params))) return notFound('dependency')
    return noContent()
  }),

  // --- comments ------------------------------------------------------------------------------------

  http.get(base('/tasks/:id/comments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    return ok(
      comments
        .all()
        .filter((comment) => comment.taskId === task.id)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(commentDto),
    )
  }),

  http.post(base('/tasks/:id/comments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(
      request,
      z.object({
        body: commentBody,
        parentId: id.nullish(),
        assignedToId: id.nullish(),
        mentions: z.array(mentionIn).default([]),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const { body, parentId = null, assignedToId = null, mentions } = parsed.data
    if (parentId && comments.find(parentId)?.taskId !== task.id) return notFound('comment')
    const comment = comments.insert({
      id: createId('cm'),
      taskId: task.id,
      parentId,
      authorId: ME,
      body,
      createdAt: utcNow(),
      editedAt: null,
      assignedToId,
      assignedById: assignedToId ? ME : null,
      isResolved: false,
      resolvedById: null,
      resolvedAt: null,
      reactions: [],
      mentions: mentions.map((entry) => ({
        employeeId: entry.employeeId ?? null,
        name: nameOf(entry.employeeId),
        taskId: entry.taskId ?? null,
      })),
      rowVersion: nextRowVersion(),
    })
    return created(commentDto(comment))
  }),

  http.put(base('/comments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const comment = comments.find(param(params))
    if (!comment) return notFound('comment')
    if (comment.authorId !== ME) return forbidden('Only the author can edit a comment.')
    const parsed = await readBody(
      request,
      z.object({ body: commentBody, mentions: z.array(mentionIn).default([]), rowVersion }),
    )
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(comment, parsed.data.rowVersion)) return stale()
    const next = {
      ...comment,
      body: parsed.data.body,
      editedAt: utcNow(),
      rowVersion: nextRowVersion(),
    }
    comments.update(comment.id, next)
    return ok(commentDto(next))
  }),

  http.patch(base('/comments/:id/assign'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const comment = comments.find(param(params))
    if (!comment) return notFound('comment')
    const parsed = await readBody(request, z.object({ assignedToId: id.nullish() }))
    if (!parsed.success) return rejected(parsed.error)
    const assignedToId = parsed.data.assignedToId ?? null
    const next = {
      ...comment,
      assignedToId,
      assignedById: assignedToId ? ME : null,
      rowVersion: nextRowVersion(),
    }
    comments.update(comment.id, next)
    return ok(commentDto(next))
  }),

  http.patch(base('/comments/:id/resolve'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const comment = comments.find(param(params))
    if (!comment) return notFound('comment')
    const parsed = await readBody(request, z.object({ resolved: z.boolean() }))
    if (!parsed.success) return rejected(parsed.error)
    const { resolved } = parsed.data
    const next = {
      ...comment,
      isResolved: resolved,
      resolvedById: resolved ? ME : null,
      resolvedAt: resolved ? utcNow() : null,
      rowVersion: nextRowVersion(),
    }
    comments.update(comment.id, next)
    return ok(commentDto(next))
  }),

  http.put(base('/comments/:id/reaction'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const comment = comments.find(param(params))
    if (!comment) return notFound('comment')
    const parsed = await readBody(request, z.object({ reaction: z.string().max(30).nullish() }))
    if (!parsed.success) return rejected(parsed.error)
    const reaction = parsed.data.reaction ?? null
    const next = {
      ...comment,
      reactions: [
        ...comment.reactions.filter((entry) => entry.employeeId !== ME),
        ...(reaction ? [{ employeeId: ME, reaction }] : []),
      ],
      rowVersion: nextRowVersion(),
    }
    comments.update(comment.id, next)
    return ok(commentDto(next))
  }),

  http.delete(base('/comments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const comment = comments.find(param(params))
    if (!comment) return notFound('comment')
    if (comment.authorId !== ME) return forbidden('Only the author can delete a comment.')
    const sent = new URL(request.url).searchParams.get('rowVersion')
    if (!sent) return invalid('rowVersion is required.', { rowVersion: 'Required.' })
    if (staleRow(comment, sent)) return stale()
    for (const reply of comments.all().filter((entry) => entry.parentId === comment.id)) {
      comments.remove(reply.id)
    }
    comments.remove(comment.id)
    return noContent()
  }),

  // --- attachments -------------------------------------------------------------------------------

  http.get(base('/tasks/:id/attachments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    return ok(
      attachments
        .all()
        .filter((entry) => entry.taskId === task.id)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((entry) => ({ ...entry, uploadedByUserId: ME_USER_ID })),
    )
  }),

  http.post(base('/tasks/:id/attachments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, z.object({ fileId: id, name: z.string().optional() }))
    if (!parsed.success) return rejected(parsed.error)
    const { fileId } = parsed.data
    if (attachments.all().some((entry) => entry.taskId === task.id && entry.fileId === fileId)) {
      return conflict('This file is already attached.', 'FILE_DUPLICATE')
    }
    // The mock's uploads live in the files mock; the name comes back from its download link.
    const url = mockFileUrl(fileId)
    const record = attachments.insert({
      id: createId('at'),
      taskId: task.id,
      fileId,
      name: uploadedNames.get(fileId)?.name ?? `file-${fileId}`,
      mimeType: uploadedNames.get(fileId)?.mimeType ?? null,
      sizeBytes: uploadedNames.get(fileId)?.size ?? null,
      uploadedByName: 'Shelley Kannes',
      createdAt: utcNow(),
      url,
    })
    return created({ ...record, uploadedByUserId: ME_USER_ID })
  }),

  http.delete(base('/attachments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    if (!attachments.remove(param(params))) return notFound('attachment')
    return noContent()
  }),

  // --- time tracking ------------------------------------------------------------------------------

  http.get(base('/tasks/:id/time-entries'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    return ok(
      timeEntries
        .all()
        .filter((entry) => entry.taskId === task.id)
        .toSorted((a, b) => b.startAt.localeCompare(a.startAt))
        .map((entry) => ({ ...entry, employeeName: nameOf(entry.employeeId) ?? '' })),
    )
  }),

  http.post(base('/tasks/:id/time-entries'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    const parsed = await readBody(request, timeEntryIn)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (!input.endAt && !input.minutes) {
      return invalid('Enter the stop time or the time spent.', {
        endAt: 'Enter the stop time or the time spent.',
      })
    }
    const startAt = toUtc(input.startAt)
    const endAt = input.endAt
      ? toUtc(input.endAt)
      : toUtc(
          new Date(new Date(`${startAt}Z`).getTime() + (input.minutes ?? 0) * 60_000).toISOString(),
        )
    const minutes = Math.round(
      (new Date(`${endAt}Z`).getTime() - new Date(`${startAt}Z`).getTime()) / 60_000,
    )
    if (minutes <= 0)
      return invalid('The stop time must be after the start time.', { endAt: 'After the start.' })
    const entry = timeEntries.insert({
      id: createId('te'),
      taskId: task.id,
      employeeId: input.employeeId ?? ME,
      startAt,
      endAt,
      minutes,
      isRunning: false,
      notes: input.notes ?? null,
      rowVersion: nextRowVersion(),
    })
    return created({ ...entry, employeeName: nameOf(entry.employeeId) ?? '' })
  }),

  http.delete(base('/time-entries/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    if (!timeEntries.remove(param(params))) return notFound('time entry')
    return noContent()
  }),

  http.post(base('/tasks/:id/timer/start'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const task = taskOf(param(params))
    if (!task) return notFound('task')
    if (timeEntries.all().some((entry) => entry.isRunning && entry.employeeId === ME)) {
      return conflict('Your timer is already running. Stop it first.', 'TIMER_RUNNING')
    }
    const entry = timeEntries.insert({
      id: createId('te'),
      taskId: task.id,
      employeeId: ME,
      startAt: utcNow(),
      endAt: null,
      minutes: null,
      isRunning: true,
      notes: null,
      rowVersion: nextRowVersion(),
    })
    return created({ ...entry, employeeName: nameOf(ME) ?? '' })
  }),

  http.post(base('/timer/stop'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, z.object({ notes: z.string().max(165).nullish() }))
    if (!parsed.success) return rejected(parsed.error)
    const running = timeEntries.all().find((entry) => entry.isRunning && entry.employeeId === ME)
    if (!running) return notFound('running timer')
    const endAt = utcNow()
    const minutes = Math.max(
      1,
      Math.round(
        (new Date(`${endAt}Z`).getTime() - new Date(`${running.startAt}Z`).getTime()) / 60_000,
      ),
    )
    const next = {
      ...running,
      endAt,
      minutes,
      isRunning: false,
      notes: parsed.data.notes ?? running.notes,
      rowVersion: nextRowVersion(),
    }
    timeEntries.update(running.id, next)
    return ok({ ...next, employeeName: nameOf(ME) ?? '' })
  }),

  // --- reminders ------------------------------------------------------------------------------------

  http.get(base('/reminders'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const entityType = url.searchParams.get('entityType')
    const entityId = url.searchParams.get('entityId')
    const mine = reminders
      .all()
      .filter((entry) => entry.ownerId === ME)
      .filter((entry) => !entityType || entry.entityType === entityType)
      .filter((entry) => !entityId || entry.entityId === entityId)
      .toSorted((a, b) => a.remindAt.localeCompare(b.remindAt))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(mine, page, pageSize))
  }),

  http.post(base('/reminders'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, reminderIn)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const task = input.entityType === 'task' ? taskOf(input.entityId) : undefined
    const reminder = reminders.insert({
      id: createId('rm'),
      workspaceId: task?.workspaceId ?? input.entityId,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: task?.name ?? null,
      name: input.name ?? task?.name ?? 'Reminder',
      ownerId: ME,
      ownerName: nameOf(ME) ?? '',
      assigneeId: input.assigneeId ?? null,
      assigneeName: nameOf(input.assigneeId),
      remindAt: toUtc(input.remindAt),
      notifyBeforeMinutes: input.notifyBeforeMinutes ?? null,
      reminderKind: input.reminderKind ?? null,
      notifiedAt: null,
      createdAt: utcNow(),
      rowVersion: nextRowVersion(),
    })
    return created(reminder)
  }),

  http.put(base('/reminders/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const reminder = reminders.find(param(params))
    if (!reminder) return notFound('reminder')
    const parsed = await readBody(request, reminderIn)
    if (!parsed.success) return rejected(parsed.error)
    if (staleRow(reminder, parsed.data.rowVersion)) return stale()
    const next = {
      ...reminder,
      name: parsed.data.name ?? reminder.name,
      remindAt: toUtc(parsed.data.remindAt),
      rowVersion: nextRowVersion(),
    }
    reminders.update(reminder.id, next)
    return ok(next)
  }),

  http.delete(base('/reminders/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    if (!reminders.remove(param(params))) return notFound('reminder')
    return noContent()
  }),

  // --- sharing ---------------------------------------------------------------------------------------

  http.get(base('/shares'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const entityType = url.searchParams.get('entityType') ?? 'task'
    const entityId = url.searchParams.get('entityId') ?? ''
    const stored = shares
      .all()
      .find((entry) => entry.entityType === entityType && entry.entityId === entityId)
    if (stored) return ok(stored)
    return ok({
      id: null,
      entityType,
      entityId,
      shareScope: 'list',
      token: null,
      link: null,
      isPublic: false,
      allowOpenTasks: true,
      validFrom: null,
      validTo: null,
      maxAccess: null,
      accessCount: 0,
      properties: [...SHARE_PROPERTIES],
      members: [],
      rowVersion: null,
    })
  }),

  http.put(base('/shares'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, shareIn)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (input.validFrom && input.validTo && input.validFrom > input.validTo) {
      return invalid('The link cannot expire before it begins.', {
        validTo: 'Expire at must be after Begin at',
      })
    }
    for (const member of input.members) {
      if (!member.employeeId === !member.email)
        return invalid('Share with a person or an email address.')
    }
    const existing = shares
      .all()
      .find((entry) => entry.entityType === input.entityType && entry.entityId === input.entityId)
    if (existing && staleRow({ rowVersion: existing.rowVersion ?? '' }, input.rowVersion))
      return stale()
    const shareId = existing?.id ?? createId('sh')
    const token = existing?.token ?? createId('tok')
    const record = {
      id: shareId,
      entityType: input.entityType,
      entityId: input.entityId,
      shareScope: input.shareScope,
      token,
      link: `/shared/${token}`,
      isPublic: input.isPublic,
      allowOpenTasks: input.allowOpenTasks,
      validFrom: input.validFrom ? toUtc(input.validFrom) : null,
      validTo: input.validTo ? toUtc(input.validTo) : null,
      maxAccess: input.maxAccess ?? null,
      accessCount: existing?.accessCount ?? 0,
      properties: [...new Set(['task_name_status', ...(input.properties ?? SHARE_PROPERTIES)])],
      members: input.members.map((member) => ({
        id: createId('shm'),
        employeeId: member.employeeId ?? null,
        employeeName: nameOf(member.employeeId),
        email: member.email ?? null,
        accessLevel: member.accessLevel,
      })),
      rowVersion: nextRowVersion(),
    }
    if (existing) shares.update(existing.id, record)
    else shares.insert(record)
    return ok(record)
  }),
]
