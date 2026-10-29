import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import { pmKeys } from './pm.api'
import type { FavoriteDto } from './pm.dto'
import { folderApiId, instant } from './pm.mappers'

// The four Project Management dashboards read the module's existing calls (workspaces, each
// workspace's tasks, comments, attachments, favourites). What has no endpoint yet (recents, docs,
// the personal list) is a typed pending call: the mock answers it in development, and against
// the real API it reports "not available" instead of failing (docs/backend-mapping/pm-dashboards.md).

const path = (rest: string) => `/projects${rest}`

/** What a favourite or a recent item points at. */
export type DashboardEntity = 'workspace' | 'folder' | 'task_list' | 'task' | 'doc'

/** A starred workspace, folder, list or task (`GET /projects/favorites?kind=favorite`). */
export interface PmBookmark {
  id: string
  entityType: Exclude<DashboardEntity, 'doc'>
  /** The item's id as the screens use it: a folder is `folder:<id>`, as in `Workspace.items`. */
  entityId: string
  name: string
  workspaceId: string
  createdAt: string
}

/** Something the caller opened lately. */
export interface PmRecentItem {
  entityType: DashboardEntity
  entityId: string
  name: string
  workspaceId: string
  workspaceName: string | null
  /** ISO instant. */
  openedAt: string
}

/** A doc as a dashboard card lists it (Backend Dependencies T1, `DocOut` without the content). */
export interface PmDocSummary {
  id: string
  workspaceId: string
  title: string
  folderId: string | null
  listId: string | null
  ownerName: string | null
  wordCount: number
  /** ISO instant. */
  updatedAt: string
}

/** One line of the caller's private to-do list on the Home dashboard. */
export interface PersonalItem {
  id: string
  title: string
  done: boolean
  /** `yyyy-MM-dd`. */
  dueDate: string | null
  createdAt: string
  rowVersion: string
}

export const PERSONAL_TITLE_MAX = 120

/** A pending endpoint's answer: its data, or "the backend does not have it yet". */
export type Pending<T> = { available: true; data: T } | { available: false }

const MISSING_STATUSES = new Set([404, 405, 501])

async function pending<T>(request: () => Promise<T>): Promise<Pending<T>> {
  try {
    return { available: true, data: await request() }
  } catch (error) {
    if (error instanceof ApiError && MISSING_STATUSES.has(error.status)) return { available: false }
    throw error
  }
}

async function getItem<T>(url: string, params: object, signal?: AbortSignal): Promise<T> {
  const { data } = await apiClient.get<ApiItem<T>>(url, { params, ...(signal ? { signal } : {}) })
  return data.data
}

/** Recents and docs come back as plain DTOs; ids may be numbers on the real API. */
interface RecentDto extends Omit<PmRecentItem, 'entityId' | 'workspaceId'> {
  entityId: string | number
  workspaceId: string | number
}
interface DocSummaryDto extends Omit<PmDocSummary, 'id' | 'workspaceId' | 'folderId' | 'listId'> {
  id: string | number
  workspaceId: string | number
  folderId: string | number | null
  listId: string | number | null
}
interface PersonalItemDto extends Omit<PersonalItem, 'id'> {
  id: string | number
}

const idOf = (value: string | number | null): string | null =>
  value === null ? null : String(value)

const personalFromApi = (dto: PersonalItemDto): PersonalItem => ({
  ...dto,
  id: String(dto.id),
  createdAt: instant(dto.createdAt),
})

export const dashboardsApi = {
  /** The caller's favourites; a dashboard shows them as its Bookmarks. */
  bookmarks: async (signal?: AbortSignal): Promise<PmBookmark[]> =>
    (await getItem<FavoriteDto[]>(path('/favorites'), { kind: 'favorite' }, signal))
      .filter((entry): entry is FavoriteDto & { entityType: PmBookmark['entityType'] } =>
        ['workspace', 'folder', 'task_list', 'task'].includes(entry.entityType),
      )
      .map((entry) => ({
        id: entry.id,
        entityType: entry.entityType,
        entityId: entry.entityType === 'folder' ? `folder:${entry.entityId}` : entry.entityId,
        name: entry.name,
        workspaceId: entry.workspaceId,
        createdAt: instant(entry.createdAt),
      }))
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),

  // TODO(backend): endpoint not available (Backend Dependencies T7, "Recents").
  /** What the caller opened lately, newest first: everywhere, in one workspace or in one folder. */
  recents: (
    scope: { workspaceId?: string | undefined; folderId?: string | undefined },
    signal?: AbortSignal,
  ): Promise<Pending<PmRecentItem[]>> =>
    pending(async () =>
      (
        await getItem<RecentDto[]>(
          path('/recents'),
          {
            limit: 8,
            ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
            ...(scope.folderId ? { folderId: folderApiId(scope.folderId) } : {}),
          },
          signal,
        )
      ).map((dto) => ({
        ...dto,
        entityId:
          dto.entityType === 'folder' ? `folder:${String(dto.entityId)}` : String(dto.entityId),
        workspaceId: String(dto.workspaceId),
        openedAt: instant(dto.openedAt),
      })),
    ),

  // TODO(backend): endpoint not available (Backend Dependencies T1, "Docs").
  /** A workspace's docs (or one folder's, by its `folder:<id>`), most recently changed first. */
  docs: (
    workspaceId: string,
    folderId: string | null,
    signal?: AbortSignal,
  ): Promise<Pending<PmDocSummary[]>> =>
    pending(async () => {
      const { data } = await apiClient.get<Paginated<DocSummaryDto>>(
        path(`/workspaces/${workspaceId}/docs`),
        {
          params: {
            page: 1,
            pageSize: 6,
            ...(folderId ? { folderId: folderApiId(folderId) } : {}),
          },
          ...(signal ? { signal } : {}),
        },
      )
      return data.data.map((dto) => ({
        ...dto,
        id: String(dto.id),
        workspaceId: String(dto.workspaceId),
        folderId: dto.folderId === null ? null : `folder:${String(dto.folderId)}`,
        listId: idOf(dto.listId),
        updatedAt: instant(dto.updatedAt),
      }))
    }),

  // TODO(backend): endpoint not available (Backend Dependencies T11, "Personal List").
  /** The caller's own to-do list, open items first. */
  personalList: (signal?: AbortSignal): Promise<Pending<PersonalItem[]>> =>
    pending(async () =>
      (await getItem<PersonalItemDto[]>(path('/personal-list'), {}, signal)).map(personalFromApi),
    ),

  // TODO(backend): endpoint not available (Backend Dependencies T11, "Personal List").
  addPersonalItem: async (input: {
    title: string
    dueDate: string | null
  }): Promise<PersonalItem> => {
    const { data } = await apiClient.post<ApiItem<PersonalItemDto>>(path('/personal-list'), input)
    return personalFromApi(data.data)
  },

  // TODO(backend): endpoint not available (Backend Dependencies T11, "Personal List").
  setPersonalItemDone: async (item: PersonalItem, done: boolean): Promise<PersonalItem> => {
    const { data } = await apiClient.patch<ApiItem<PersonalItemDto>>(
      path(`/personal-list/${item.id}`),
      { done, rowVersion: item.rowVersion },
    )
    return personalFromApi(data.data)
  },

  // TODO(backend): endpoint not available (Backend Dependencies T11, "Personal List").
  deletePersonalItem: async (item: PersonalItem): Promise<void> => {
    await apiClient.delete(path(`/personal-list/${item.id}`), {
      params: { rowVersion: item.rowVersion },
    })
  },
}

/** Under the module's key, so every Project Management change refreshes the dashboards too. */
export const dashboardKeys = {
  bookmarks: () => [...pmKeys.all, 'dashboard', 'bookmarks'] as const,
  recents: (workspaceId: string | null, folderId: string | null) =>
    [...pmKeys.all, 'dashboard', 'recents', workspaceId ?? 'all', folderId ?? 'all'] as const,
  docs: (workspaceId: string, folderId: string | null) =>
    [...pmKeys.all, 'dashboard', 'docs', workspaceId, folderId ?? 'all'] as const,
  personalList: () => [...pmKeys.all, 'dashboard', 'personal-list'] as const,
}
