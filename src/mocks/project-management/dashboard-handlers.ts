import { addDays, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import { createMockCollection } from '../collection'
import { conflict, notFound, ok, readBody, rejected } from '../payroll/http'
import { apiPath, createId, latency, paginate, readPageParams, requireAuth } from '../utils'
import { folders, lists, tasks, workspaces } from './db'
import { nextRowVersion } from './seed'

/**
 * Development-only answers for the dashboards' pending endpoints (Backend Dependencies T1 Docs,
 * T7 Recents, T11 Personal List): none exists on the backend yet, and the screens mark what they
 * show from here as sample data. Names come from the Project Management mock, so they match.
 */

const base = (path: string) => apiPath(`/projects${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60_000).toISOString().slice(0, 19)
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

// --- recents ----------------------------------------------------------------------------------------

type RecentType = 'workspace' | 'folder' | 'task_list' | 'task' | 'doc'

/** What Shelley Kannes opened lately (resolved against the mock at request time). */
const RECENT_SEED: { entityType: RecentType; entityId: string; hours: number }[] = [
  { entityType: 'task', entityId: 'tk_quali', hours: 1 },
  { entityType: 'workspace', entityId: 'ws_uxui', hours: 2 },
  { entityType: 'task_list', entityId: 'it_flow', hours: 20 },
  { entityType: 'doc', entityId: 'doc_interview', hours: 26 },
  { entityType: 'folder', entityId: 'fd_research', hours: 50 },
  { entityType: 'task', entityId: 'tk_audit', hours: 72 },
  { entityType: 'workspace', entityId: 'ws_qa', hours: 96 },
  { entityType: 'task', entityId: 'tk_wire', hours: 130 },
]

interface Located {
  name: string
  workspaceId: string
  folderId: string | null
}

function locate(entityType: RecentType, entityId: string): Located | null {
  switch (entityType) {
    case 'workspace': {
      const workspace = workspaces.find(entityId)
      return workspace ? { name: workspace.name, workspaceId: workspace.id, folderId: null } : null
    }
    case 'folder': {
      const folder = folders.find(entityId)
      return folder
        ? { name: folder.name, workspaceId: folder.workspaceId, folderId: folder.id }
        : null
    }
    case 'task_list': {
      const list = lists.find(entityId)
      return list
        ? { name: list.name, workspaceId: list.workspaceId, folderId: list.folderId }
        : null
    }
    case 'task': {
      const task = tasks.find(entityId)
      if (!task) return null
      const list = task.taskListId ? lists.find(task.taskListId) : undefined
      return { name: task.name, workspaceId: task.workspaceId, folderId: list?.folderId ?? null }
    }
    case 'doc': {
      const doc = docs.find(entityId)
      return doc ? { name: doc.title, workspaceId: doc.workspaceId, folderId: doc.folderId } : null
    }
  }
}

// --- docs -------------------------------------------------------------------------------------------

interface DocRecord {
  id: string
  workspaceId: string
  title: string
  folderId: string | null
  listId: string | null
  ownerName: string | null
  wordCount: number
  updatedAt: string
}

const docs = createMockCollection<DocRecord>({
  seed: () => [
    {
      id: 'doc_interview',
      workspaceId: 'ws_uxui',
      title: 'Interview guide',
      folderId: 'fd_research',
      listId: 'it_quali',
      ownerName: 'Shelley Kannes',
      wordCount: 1240,
      updatedAt: hoursAgo(26),
    },
    {
      id: 'doc_personas',
      workspaceId: 'ws_uxui',
      title: 'Persona template',
      folderId: 'fd_research',
      listId: 'it_user_research',
      ownerName: 'Areeba Hameed',
      wordCount: 610,
      updatedAt: hoursAgo(74),
    },
    {
      id: 'doc_wire_review',
      workspaceId: 'ws_uxui',
      title: 'Wire-frame review notes',
      folderId: 'fd_ux_process',
      listId: 'it_wire',
      ownerName: 'Rehan Ahmad',
      wordCount: 480,
      updatedAt: hoursAgo(5),
    },
    {
      id: 'doc_principles',
      workspaceId: 'ws_uxui',
      title: 'Design principles',
      folderId: null,
      listId: null,
      ownerName: 'Shelley Kannes',
      wordCount: 2015,
      updatedAt: hoursAgo(200),
    },
    {
      id: 'doc_a11y',
      workspaceId: 'ws_qa',
      title: 'Accessibility checklist',
      folderId: null,
      listId: null,
      ownerName: 'Bilal Ahmed',
      wordCount: 930,
      updatedAt: hoursAgo(30),
    },
  ],
})

// --- personal list ------------------------------------------------------------------------------------

interface PersonalRecord {
  id: string
  title: string
  done: boolean
  dueDate: string | null
  createdAt: string
  rowVersion: string
}

const personalList = createMockCollection<PersonalRecord>({
  storageKey: 'hrms-mock-pm-v2-personal-list',
  seed: () => [
    {
      id: 'pl_slides',
      title: 'Prepare the sprint review slides',
      done: false,
      dueDate: day(1),
      createdAt: hoursAgo(30),
      rowVersion: nextRowVersion(),
    },
    {
      id: 'pl_room',
      title: 'Book a room for the usability test',
      done: false,
      dueDate: day(3),
      createdAt: hoursAgo(20),
      rowVersion: nextRowVersion(),
    },
    {
      id: 'pl_reply',
      title: 'Reply to Bilal about the persona interviews',
      done: true,
      dueDate: null,
      createdAt: hoursAgo(48),
      rowVersion: nextRowVersion(),
    },
  ],
})

/** Restores the sample docs and personal list (part of `resetMockDb`). */
export function resetPmDashboardMocks(): void {
  docs.reset()
  personalList.reset()
}

const id = z.union([z.string(), z.number()]).transform(String)

export const pmDashboardHandlers = [
  // TODO(backend): Backend Dependencies T7.
  http.get(base('/recents'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspaceId')
    const folderId = url.searchParams.get('folderId')
    const limit = Number(url.searchParams.get('limit') ?? '8') || 8
    const items = RECENT_SEED.flatMap((entry) => {
      const found = locate(entry.entityType, entry.entityId)
      if (!found) return []
      if (workspaceId && found.workspaceId !== workspaceId) return []
      if (folderId && found.folderId !== folderId) return []
      return [
        {
          entityType: entry.entityType,
          entityId: entry.entityId,
          name: found.name,
          workspaceId: found.workspaceId,
          workspaceName: workspaces.find(found.workspaceId)?.name ?? null,
          openedAt: hoursAgo(entry.hours),
        },
      ]
    })
    return ok(items.slice(0, limit))
  }),

  // TODO(backend): Backend Dependencies T1.
  http.get(base('/workspaces/:id/docs'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const workspaceId = String(params.id)
    if (!workspaces.find(workspaceId)) return notFound('workspace')
    const url = new URL(request.url)
    const folderId = url.searchParams.get('folderId')
    const { page, pageSize } = readPageParams(url)
    const rows = docs
      .all()
      .filter((doc) => doc.workspaceId === workspaceId && (!folderId || doc.folderId === folderId))
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  // TODO(backend): Backend Dependencies T11.
  http.get(base('/personal-list'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok(personalList.all())
  }),

  http.post(base('/personal-list'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(
      request,
      z.object({
        title: z.string().trim().min(1, 'Write what you need to do').max(120),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const record = personalList.insert({
      id: createId('pl'),
      title: parsed.data.title,
      done: false,
      dueDate: parsed.data.dueDate,
      createdAt: new Date().toISOString().slice(0, 19),
      rowVersion: nextRowVersion(),
    })
    return ok(record)
  }),

  http.patch(base('/personal-list/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const record = personalList.find(String(params.id))
    if (!record) return notFound('item')
    const parsed = await readBody(request, z.object({ done: z.boolean(), rowVersion: id }))
    if (!parsed.success) return rejected(parsed.error)
    if (parsed.data.rowVersion !== record.rowVersion) {
      return conflict('Someone changed this item. Reload and try again.')
    }
    const next = { ...record, done: parsed.data.done, rowVersion: nextRowVersion() }
    personalList.update(record.id, next)
    return ok(next)
  }),

  http.delete(base('/personal-list/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    if (!personalList.remove(String(params.id))) return notFound('item')
    return new HttpResponse(null, { status: 204 })
  }),
]
