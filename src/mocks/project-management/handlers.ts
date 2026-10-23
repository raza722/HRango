import { http } from 'msw'
import { z } from 'zod'

import {
  ORGANIZER_FEATURES,
  type PmPerson,
  type ShareSettings,
  STATUS_GROUPS,
  STATUS_TEMPLATES,
  type Task,
  TASK_COLUMN_KEYS,
  type TaskRow,
  VIEW_KINDS,
  WORKFLOW_TEMPLATES,
  WORKSPACE_DESCRIPTION_MAX,
  WORKSPACE_NAME_MAX,
  type WorkspaceItem,
} from '@/features/project-management'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { employeeRef } from '../payroll/engine'
import { conflict, invalid, ME, notFound, now, ok, readBody, rejected } from '../payroll/http'
import { apiPath, createId, latency, requireAuth } from '../utils'
import { comments, shares, tags, tasks, workspaceItems, workspaces } from './db'
import { columnsFor } from './seed'

const base = (path: string) => apiPath(`/project-management${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const person = (id: string): PmPerson => {
  const ref = employeeRef(id)
  return {
    id,
    name: ref.name,
    designation: ref.designation,
    department: ref.department,
    photoUrl: ref.photoUrl,
  }
}

/** The fields a partial body sets (zod keeps absent keys out, but be explicit). */
const defined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>

const idParam = (params: Record<string, string | readonly string[] | undefined>, name = 'id') =>
  String(params[name] ?? '')

const employeeId = z
  .string()
  .refine((id) => Boolean(findEmployee(id)), { message: 'Choose an employee' })

const statusSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name the status').max(40, 'Keep the status under 40 characters'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour'),
  group: z.enum(STATUS_GROUPS),
})

const setupSchema = z.object({
  views: z
    .array(z.enum(VIEW_KINDS))
    .refine((views) => views.includes('list'), { message: 'List view is always required' }),
  defaultView: z.enum(VIEW_KINDS),
  statusMode: z.enum(['default', 'custom']),
  statusTemplate: z.enum(STATUS_TEMPLATES),
  statuses: z.array(statusSchema).min(1, 'Keep at least one status'),
  organizer: z.array(z.enum(ORGANIZER_FEATURES)),
})

const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the workspace name')
    .max(WORKSPACE_NAME_MAX, `Keep the name to ${WORKSPACE_NAME_MAX} characters`),
  ownerId: employeeId,
  description: z
    .string()
    .max(
      WORKSPACE_DESCRIPTION_MAX,
      `Keep the description to ${WORKSPACE_DESCRIPTION_MAX} characters`,
    ),
  visibility: z.enum(['private', 'workspace', 'public'], {
    error: 'Choose who can see the workspace',
  }),
  memberIds: z.array(employeeId),
  department: z.string().min(1, 'Select your department'),
  template: z.enum(WORKFLOW_TEMPLATES, { error: 'Choose a workflow' }),
  setup: setupSchema,
})

const permissionLevel = z.enum(['default', 'can-edit', 'can-view', 'private'])
const columnSchema = z.object({
  key: z.enum(TASK_COLUMN_KEYS),
  visible: z.boolean(),
  permission: z.object({
    defaultLevel: permissionLevel,
    roles: z.record(z.string(), permissionLevel),
    members: z.array(z.object({ employeeId, level: permissionLevel })),
  }),
})

const workspacePatchSchema = z.object({
  name: workspaceSchema.shape.name.optional(),
  description: workspaceSchema.shape.description.optional(),
  coverUrl: z.string().nullable().optional(),
  favorite: z.boolean().optional(),
  memberIds: z.array(employeeId).optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  columns: z.array(columnSchema).optional(),
  setup: setupSchema.partial().optional(),
})

const itemSchema = z.object({
  kind: z.enum(['folder', 'list', 'doc']),
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep the name under 80 characters'),
  parentId: z.string().nullable(),
})

const taskInputSchema = z.object({
  workspaceId: z.string().min(1),
  listId: z.string().nullable(),
  parentId: z.string().nullable(),
  name: z
    .string()
    .trim()
    .min(1, 'Enter the task name')
    .max(200, 'Keep the name under 200 characters'),
  statusId: z.string().optional(),
})

const taskName = taskInputSchema.shape.name
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time')

const taskPatchSchema = z
  .object({
    listId: z.string().nullable(),
    parentId: z.string().nullable(),
    name: taskName,
    description: z.string().max(5000),
    statusId: z.string().min(1),
    type: z.enum(['task', 'milestone']),
    assigneeIds: z.array(employeeId),
    invitedEmails: z.array(z.email('Enter a valid email')),
    startDate: day.nullable(),
    startTime: time.nullable(),
    dueDate: day.nullable(),
    dueTime: time.nullable(),
    recurrence: z
      .object({
        every: z.number().int().min(1).max(365),
        unit: z.enum(['day', 'week', 'month', 'year']),
        weekdays: z.array(z.number().int().min(0).max(6)),
        ends: z.union([
          z.object({ kind: z.literal('never') }),
          z.object({ kind: z.literal('on'), date: day }),
          z.object({ kind: z.literal('after'), count: z.number().int().min(1).max(999) }),
        ]),
      })
      .nullable(),
    priority: z.enum(['urgent', 'high', 'normal', 'low']).nullable(),
    tagIds: z.array(z.string()),
    labelIds: z.array(z.string()),
    waitingOn: z.array(z.string()),
    blocking: z.array(z.string()),
    storyPoints: z.array(z.object({ employeeId, points: z.number().int().min(0).max(100) })),
    rating: z.number().int().min(0).max(3),
    timeEstimateMinutes: z.number().int().min(0).max(100_000).nullable(),
    timeEntries: z.array(
      z.object({
        id: z.string(),
        employeeId,
        date: day,
        start: time,
        end: time,
        minutes: z.number().int().min(0),
        notes: z.string().max(165, 'Keep notes to 165 characters'),
      }),
    ),
    timerStartedAt: z.string().nullable(),
    attachments: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        size: z.number().min(0),
        source: z.enum(['device', 'google-drive', 'google-docs', 'dropbox', 'box', 'onedrive']),
        uploadedById: z.string(),
        uploadedAt: z.string(),
      }),
    ),
    reminderAt: z.string().nullable(),
    favorite: z.boolean(),
    order: z.number(),
  })
  .partial()
  .refine(
    (patch) => patch.startDate == null || patch.dueDate == null || patch.startDate <= patch.dueDate,
    {
      message: 'The due date cannot be before the start date',
      path: ['dueDate'],
    },
  )

const commentInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a comment')
    .max(2000, 'Keep the comment under 2000 characters'),
  parentId: z.string().nullable().optional(),
  assignedToId: employeeId.nullable().optional(),
})

const commentPatchSchema = z
  .object({
    body: commentInputSchema.shape.body,
    assignedToId: employeeId.nullable(),
    resolved: z.boolean(),
    likedByIds: z.array(z.string()),
  })
  .partial()

const tagSchema = z.object({
  kind: z.enum(['tag', 'label']),
  name: z.string().trim().min(1, 'Enter a name').max(40, 'Keep the name under 40 characters'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour'),
})

const shareSchema = z.object({
  targetId: z.string().min(1),
  scope: z.enum(['list', 'page']),
  people: z.array(z.object({ employeeId, access: z.enum(['full-edit', 'edit', 'view']) })),
  invitedEmails: z.array(z.email('Enter a valid email')),
  linkEnabled: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  maxAccess: z.number().int().min(1).max(10_000).nullable(),
  allowOpeningTasks: z.boolean(),
  properties: z.array(z.string()),
})

/** Effective due-date ordering: the task's own date, or none. */
const toRow = (task: Task, all: readonly Task[]): TaskRow => {
  const own = comments.all().filter((comment) => comment.taskId === task.id)
  const latest = own.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return {
    ...task,
    subtaskCount: all.filter((other) => other.parentId === task.id).length,
    commentCount: own.length,
    latestComment: latest
      ? { authorId: latest.authorId, body: latest.body, createdAt: latest.createdAt }
      : null,
  }
}

/** Items in a folder, the folder included, so deleting a folder empties it. */
function descendants(item: WorkspaceItem): WorkspaceItem[] {
  const children = workspaceItems.all().filter((other) => other.parentId === item.id)
  return [item, ...children.flatMap(descendants)]
}

function nextTaskCode(): string {
  const highest = tasks.all().reduce((max, task) => {
    const number = Number(task.code.replace(/\D/g, ''))
    return Number.isFinite(number) && number > max ? number : max
  }, 0)
  return `#HR${String(highest + 1).padStart(9, '0')}`
}

const defaultShare = (targetId: string): ShareSettings => ({
  targetId,
  scope: 'list',
  people: [],
  invitedEmails: [],
  linkEnabled: false,
  validFrom: null,
  validTo: null,
  maxAccess: null,
  allowOpeningTasks: true,
  properties: ['name-status'],
})

export const projectManagementHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok({
      me: person(ME),
      employees: DIRECTORY.map((employee) => person(employee.id)),
      departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort(),
    })
  }),

  // --- workspaces ---------------------------------------------------------------------------------

  http.get(base('/workspaces'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const visible = workspaces
      .all()
      .filter(
        (workspace) =>
          workspace.visibility !== 'private' ||
          workspace.ownerId === ME ||
          workspace.memberIds.includes(ME),
      )
    const ids = new Set(visible.map((workspace) => workspace.id))
    return ok({
      workspaces: visible,
      items: workspaceItems
        .all()
        .filter((item) => ids.has(item.workspaceId))
        .toSorted((a, b) => a.order - b.order),
    })
  }),

  http.post(base('/workspaces'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, workspaceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const taken = workspaces
      .all()
      .some((workspace) => workspace.name.toLowerCase() === input.name.toLowerCase())
    if (taken) {
      return conflict('A workspace with this name already exists.', 'DUPLICATE_NAME', {
        name: 'A workspace with this name already exists',
      })
    }
    if (input.visibility === 'private' && input.memberIds.length === 0) {
      return invalid('Add the members who can see this private workspace.', {
        memberIds: 'Add at least one member',
      })
    }
    const memberIds = [...new Set([input.ownerId, ME, ...input.memberIds])]
    const created = workspaces.insert({
      ...input,
      memberIds,
      id: createId('ws'),
      coverUrl: null,
      favorite: false,
      createdById: ME,
      createdAt: now(),
      columns: columnsFor(),
    })
    return ok(created)
  }),

  http.patch(base('/workspaces/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = workspaces.find(idParam(params))
    if (!current) return notFound('workspace')
    const parsed = await readBody(request, workspacePatchSchema)
    if (!parsed.success) return rejected(parsed.error)
    const { setup, ...rest } = parsed.data
    const next = {
      ...current,
      ...defined(rest),
      setup: {
        ...current.setup,
        ...defined(setup ?? {}),
      },
    }
    return ok(workspaces.update(current.id, next))
  }),

  http.delete(base('/workspaces/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const id = idParam(params)
    if (!workspaces.find(id)) return notFound('workspace')
    for (const item of workspaceItems.all().filter((entry) => entry.workspaceId === id)) {
      workspaceItems.remove(item.id)
    }
    for (const task of tasks.all().filter((entry) => entry.workspaceId === id))
      tasks.remove(task.id)
    workspaces.remove(id)
    return ok(null)
  }),

  // --- folders, lists, docs -----------------------------------------------------------------------

  http.post(base('/workspaces/:id/items'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = idParam(params)
    if (!workspaces.find(workspaceId)) return notFound('workspace')
    const parsed = await readBody(request, itemSchema)
    if (!parsed.success) return rejected(parsed.error)
    const { parentId } = parsed.data
    if (parentId !== null && workspaceItems.find(parentId)?.kind !== 'folder') {
      return invalid('Lists and docs can only go inside a folder.')
    }
    const siblings = workspaceItems
      .all()
      .filter((item) => item.workspaceId === workspaceId && item.parentId === parentId)
    return ok(
      workspaceItems.insert({
        ...parsed.data,
        id: createId('it'),
        workspaceId,
        favorite: false,
        order: siblings.length,
      }),
    )
  }),

  http.patch(base('/items/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = workspaceItems.find(idParam(params))
    if (!current) return notFound('item')
    const parsed = await readBody(
      request,
      z
        .object({
          name: itemSchema.shape.name,
          favorite: z.boolean(),
          parentId: z.string().nullable(),
        })
        .partial(),
    )
    if (!parsed.success) return rejected(parsed.error)
    const patch = defined(parsed.data)
    return ok(workspaceItems.update(current.id, { ...current, ...patch }))
  }),

  http.delete(base('/items/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = workspaceItems.find(idParam(params))
    if (!current) return notFound('item')
    const removed = descendants(current)
    const removedIds = new Set(removed.map((item) => item.id))
    for (const item of removed) workspaceItems.remove(item.id)
    for (const task of tasks
      .all()
      .filter((entry) => entry.listId && removedIds.has(entry.listId))) {
      tasks.remove(task.id)
    }
    return ok(null)
  }),

  // --- tasks --------------------------------------------------------------------------------------

  http.get(base('/workspaces/:id/tasks'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = idParam(params)
    if (!workspaces.find(workspaceId)) return notFound('workspace')
    const listId = new URL(request.url).searchParams.get('listId')
    const all = tasks.all().filter((task) => task.workspaceId === workspaceId)
    const inScope = listId ? all.filter((task) => task.listId === listId) : all
    return ok(inScope.toSorted((a, b) => a.order - b.order).map((task) => toRow(task, all)))
  }),

  http.post(base('/tasks'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, taskInputSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const workspace = workspaces.find(input.workspaceId)
    if (!workspace) return notFound('workspace')
    const statusId = input.statusId ?? workspace.setup.statuses[0]?.id ?? ''
    if (!workspace.setup.statuses.some((status) => status.id === statusId)) {
      return invalid('That status is not in this workspace.')
    }
    const created = tasks.insert({
      id: createId('tk'),
      code: nextTaskCode(),
      workspaceId: input.workspaceId,
      listId: input.listId,
      parentId: input.parentId,
      name: input.name,
      description: '',
      statusId,
      type: 'task',
      assigneeIds: [],
      invitedEmails: [],
      startDate: null,
      startTime: null,
      dueDate: null,
      dueTime: null,
      recurrence: null,
      priority: null,
      tagIds: [],
      labelIds: [],
      waitingOn: [],
      blocking: [],
      storyPoints: [],
      rating: 0,
      timeEstimateMinutes: null,
      timeEntries: [],
      timerStartedAt: null,
      attachments: [],
      reminderAt: null,
      favorite: false,
      createdById: ME,
      createdAt: now(),
      closedAt: null,
      order: Math.max(0, ...tasks.all().map((task) => task.order)) + 1,
    })
    return ok(created)
  }),

  http.patch(base('/tasks/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = tasks.find(idParam(params))
    if (!current) return notFound('task')
    const parsed = await readBody(request, taskPatchSchema)
    if (!parsed.success) return rejected(parsed.error)
    const patch = defined(parsed.data) as Partial<Task>
    const next: Task = { ...current, ...patch }
    if (next.startDate && next.dueDate && next.startDate > next.dueDate) {
      return invalid('The due date cannot be before the start date.', {
        dueDate: 'The due date cannot be before the start date',
      })
    }
    const workspace = workspaces.find(current.workspaceId)
    const status = workspace?.setup.statuses.find((entry) => entry.id === next.statusId)
    if (!status) return invalid('That status is not in this workspace.')
    if (next.parentId === next.id) return invalid('A task cannot be its own subtask.')
    // Closing stamps Date Closed; reopening clears it.
    const closed = status.group === 'closed' || status.group === 'done'
    next.closedAt = closed ? (current.closedAt ?? now()) : null
    return ok(tasks.update(current.id, next))
  }),

  http.post(base('/tasks/:id/move'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const root = tasks.find(idParam(params))
    if (!root) return notFound('task')
    const parsed = await readBody(
      request,
      z.object({ workspaceId: z.string().min(1), listId: z.string().nullable() }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const { workspaceId, listId } = parsed.data
    const from = workspaces.find(root.workspaceId)
    const to = workspaces.find(workspaceId)
    if (!from || !to) return notFound('workspace')
    const list = listId ? workspaceItems.find(listId) : null
    if (listId && (list?.kind !== 'list' || list.workspaceId !== to.id)) {
      return invalid('Choose a list of that workspace.')
    }
    // The task and its subtasks move together and keep their IDs and comments.
    const family = new Set([root.id])
    let grew = true
    while (grew) {
      grew = false
      for (const task of tasks.all()) {
        if (task.parentId && family.has(task.parentId) && !family.has(task.id)) {
          family.add(task.id)
          grew = true
        }
      }
    }
    const targetTags = new Set(
      tags
        .all()
        .filter((tag) => tag.workspaceId === to.id)
        .map((tag) => tag.id),
    )
    const statusIn = (statusId: string) => {
      const own = from.setup.statuses.find((status) => status.id === statusId)
      const same = to.setup.statuses.find((status) => status.id === statusId)
      const named = own && to.setup.statuses.find((status) => status.name === own.name)
      const group = own && to.setup.statuses.find((status) => status.group === own.group)
      return same ?? named ?? group ?? to.setup.statuses[0]
    }
    for (const id of family) {
      const task = tasks.find(id)
      const status = task && statusIn(task.statusId)
      if (!task || !status) continue
      const closed = status.group === 'closed' || status.group === 'done'
      tasks.update(id, {
        ...task,
        workspaceId: to.id,
        listId,
        parentId: id === root.id ? null : task.parentId,
        statusId: status.id,
        // Tags and labels belong to a workspace; links only reach tasks that move too.
        tagIds: task.tagIds.filter((tag) => targetTags.has(tag)),
        labelIds: task.labelIds.filter((tag) => targetTags.has(tag)),
        waitingOn: task.waitingOn.filter((other) => family.has(other)),
        blocking: task.blocking.filter((other) => family.has(other)),
        closedAt: closed ? (task.closedAt ?? now()) : null,
      })
    }
    for (const task of tasks.all()) {
      if (family.has(task.id)) continue
      const waitingOn = task.waitingOn.filter((other) => !family.has(other))
      const blocking = task.blocking.filter((other) => !family.has(other))
      if (waitingOn.length !== task.waitingOn.length || blocking.length !== task.blocking.length) {
        tasks.update(task.id, { ...task, waitingOn, blocking })
      }
    }
    return ok(tasks.find(root.id))
  }),

  http.delete(base('/tasks/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const id = idParam(params)
    if (!tasks.find(id)) return notFound('task')
    const doomed = new Set([
      id,
      ...tasks
        .all()
        .filter((task) => task.parentId === id)
        .map((t) => t.id),
    ])
    for (const taskId of doomed) tasks.remove(taskId)
    for (const task of tasks.all()) {
      const waitingOn = task.waitingOn.filter((other) => !doomed.has(other))
      const blocking = task.blocking.filter((other) => !doomed.has(other))
      if (waitingOn.length !== task.waitingOn.length || blocking.length !== task.blocking.length) {
        tasks.update(task.id, { ...task, waitingOn, blocking })
      }
    }
    for (const comment of comments.all().filter((entry) => doomed.has(entry.taskId))) {
      comments.remove(comment.id)
    }
    return ok(null)
  }),

  // --- comments -----------------------------------------------------------------------------------

  http.get(base('/tasks/:id/comments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const taskId = idParam(params)
    if (!tasks.find(taskId)) return notFound('task')
    return ok(
      comments
        .all()
        .filter((comment) => comment.taskId === taskId)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
    )
  }),

  http.post(base('/tasks/:id/comments'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const taskId = idParam(params)
    if (!tasks.find(taskId)) return notFound('task')
    const parsed = await readBody(request, commentInputSchema)
    if (!parsed.success) return rejected(parsed.error)
    const { body, parentId = null, assignedToId = null } = parsed.data
    if (parentId && comments.find(parentId)?.taskId !== taskId) return notFound('comment')
    return ok(
      comments.insert({
        id: createId('cm'),
        taskId,
        parentId,
        authorId: ME,
        body,
        createdAt: now(),
        editedAt: null,
        assignedToId,
        assignedById: assignedToId ? ME : null,
        resolved: false,
        resolvedById: null,
        likedByIds: [],
      }),
    )
  }),

  http.patch(base('/comments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = comments.find(idParam(params))
    if (!current) return notFound('comment')
    const parsed = await readBody(request, commentPatchSchema)
    if (!parsed.success) return rejected(parsed.error)
    const { body, assignedToId, resolved, likedByIds } = parsed.data
    if (body !== undefined && current.authorId !== ME) {
      return invalid('Only the author can edit a comment.')
    }
    return ok(
      comments.update(current.id, {
        ...current,
        ...(body === undefined ? {} : { body, editedAt: now() }),
        ...(assignedToId === undefined
          ? {}
          : { assignedToId, assignedById: assignedToId ? ME : null }),
        ...(resolved === undefined ? {} : { resolved, resolvedById: resolved ? ME : null }),
        ...(likedByIds === undefined ? {} : { likedByIds }),
      }),
    )
  }),

  http.delete(base('/comments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = comments.find(idParam(params))
    if (!current) return notFound('comment')
    if (current.authorId !== ME) return invalid('Only the author can delete a comment.')
    for (const reply of comments.all().filter((entry) => entry.parentId === current.id)) {
      comments.remove(reply.id)
    }
    comments.remove(current.id)
    return ok(null)
  }),

  // --- tags and labels ----------------------------------------------------------------------------

  http.get(base('/workspaces/:id/tags'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = idParam(params)
    return ok(tags.all().filter((tag) => tag.workspaceId === workspaceId))
  }),

  http.post(base('/workspaces/:id/tags'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = idParam(params)
    if (!workspaces.find(workspaceId)) return notFound('workspace')
    const parsed = await readBody(request, tagSchema)
    if (!parsed.success) return rejected(parsed.error)
    const taken = tags
      .all()
      .some(
        (tag) =>
          tag.workspaceId === workspaceId &&
          tag.kind === parsed.data.kind &&
          tag.name.toLowerCase() === parsed.data.name.toLowerCase(),
      )
    if (taken) return conflict('That name is already used.', 'DUPLICATE_NAME')
    return ok(tags.insert({ ...parsed.data, id: createId('tg'), workspaceId }))
  }),

  http.patch(base('/tags/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const current = tags.find(idParam(params))
    if (!current) return notFound('tag')
    const parsed = await readBody(request, tagSchema.partial())
    if (!parsed.success) return rejected(parsed.error)
    const patch = defined(parsed.data)
    return ok(tags.update(current.id, { ...current, ...patch }))
  }),

  http.delete(base('/tags/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const id = idParam(params)
    if (!tags.find(id)) return notFound('tag')
    tags.remove(id)
    for (const task of tasks.all()) {
      if (task.tagIds.includes(id) || task.labelIds.includes(id)) {
        tasks.update(task.id, {
          ...task,
          tagIds: task.tagIds.filter((other) => other !== id),
          labelIds: task.labelIds.filter((other) => other !== id),
        })
      }
    }
    return ok(null)
  }),

  // --- sharing ------------------------------------------------------------------------------------

  http.get(base('/shares/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const targetId = idParam(params)
    const stored = shares.find(targetId)
    if (!stored) return ok(defaultShare(targetId))
    const { id: _id, ...settings } = stored
    return ok(settings)
  }),

  http.put(base('/shares/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const targetId = idParam(params)
    const parsed = await readBody(request, shareSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (
      parsed.data.validFrom &&
      parsed.data.validTo &&
      parsed.data.validFrom > parsed.data.validTo
    ) {
      return invalid('The link cannot expire before it begins.', {
        validTo: 'Expire at must be after Begin at',
      })
    }
    const record = { ...parsed.data, targetId, id: targetId }
    if (shares.find(targetId)) shares.update(targetId, record)
    else shares.insert(record)
    return ok(parsed.data)
  }),
]
