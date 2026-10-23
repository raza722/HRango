import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type {
  AreaRow,
  BranchRow,
  JobTitle,
  JobTitleInput,
  JobTitleRow,
  LocationRow,
  OrgArea,
  OrgAreaInput,
  OrgBranch,
  OrgBranchInput,
  OrgLocation,
  OrgLocationInput,
} from '../types/settings.types'

/** Root of every Settings query key, so one invalidation refreshes all of them. */
export const SETTINGS_QUERY_ROOT = 'settings'

/** Query string of a Control Panel list. Filters narrow it to one parent. */
export interface OrgListParams extends PageParams {
  search?: string
  companyId?: string
  locationId?: string
}

export interface OrgResourceConfig {
  /** Query-key segment, e.g. `branches`. */
  key: string
  /** API path under the base URL, e.g. `/settings/branches`. */
  path: string
  /** Lower-case names for messages: "branch" / "branches". */
  singular: string
  plural: string
}

/**
 * A Control Panel record type (Branch, Location, Area, Job Title): its REST
 * calls, query keys and query options. Every list shares the same shape, so
 * the hooks and list page are written once against this.
 */
export interface OrgResource<
  TRecord extends { id: string; name: string },
  TInput,
  TRow extends { id: string; name: string },
> extends OrgResourceConfig {
  api: {
    list: (params: OrgListParams, signal?: AbortSignal) => Promise<Paginated<TRow>>
    get: (id: string, signal?: AbortSignal) => Promise<TRecord>
    create: (input: TInput) => Promise<TRecord>
    update: (id: string, input: TInput) => Promise<TRecord>
    remove: (id: string) => Promise<void>
  }
  keys: {
    all: readonly [typeof SETTINGS_QUERY_ROOT, string]
    lists: () => readonly unknown[]
    list: (params: OrgListParams) => readonly unknown[]
    detail: (id: string) => readonly unknown[]
  }
  listQuery: (params: OrgListParams) => ReturnType<typeof listQueryOptions<TRow>>
  detailQuery: (id: string) => ReturnType<typeof detailQueryOptions<TRecord>>
}

/** Drops empty filters so `{ search: '' }` and `{}` share a cache entry. */
function compactParams(params: OrgListParams): OrgListParams {
  const result: OrgListParams = { page: params.page, pageSize: params.pageSize }
  if (params.search?.trim()) result.search = params.search.trim()
  if (params.companyId) result.companyId = params.companyId
  if (params.locationId) result.locationId = params.locationId
  return result
}

function listQueryOptions<TRow>(
  queryKey: readonly unknown[],
  fetchPage: (signal: AbortSignal) => Promise<Paginated<TRow>>,
) {
  return queryOptions({
    queryKey,
    queryFn: ({ signal }) => fetchPage(signal),
    placeholderData: keepPreviousData,
  })
}

function detailQueryOptions<TRecord>(
  queryKey: readonly unknown[],
  fetchOne: (signal: AbortSignal) => Promise<TRecord>,
) {
  return queryOptions({ queryKey, queryFn: ({ signal }) => fetchOne(signal) })
}

export function createOrgResource<
  TRecord extends { id: string; name: string },
  TInput,
  TRow extends { id: string; name: string },
>(config: OrgResourceConfig): OrgResource<TRecord, TInput, TRow> {
  const { path } = config
  const all = [SETTINGS_QUERY_ROOT, config.key] as const
  const keys = {
    all,
    lists: () => [...all, 'list'] as const,
    list: (params: OrgListParams) => [...all, 'list', compactParams(params)] as const,
    detail: (id: string) => [...all, 'detail', id] as const,
  }

  const api = {
    async list(params: OrgListParams, signal?: AbortSignal) {
      const { data } = await apiClient.get<Paginated<TRow>>(path, {
        params: compactParams(params),
        signal,
      })
      return data
    },
    async get(id: string, signal?: AbortSignal) {
      const { data } = await apiClient.get<ApiItem<TRecord>>(`${path}/${id}`, { signal })
      return data.data
    },
    async create(input: TInput) {
      const { data } = await apiClient.post<ApiItem<TRecord>>(path, input)
      return data.data
    },
    async update(id: string, input: TInput) {
      const { data } = await apiClient.put<ApiItem<TRecord>>(`${path}/${id}`, input)
      return data.data
    },
    async remove(id: string) {
      await apiClient.delete(`${path}/${id}`)
    },
  }

  return {
    ...config,
    api,
    keys,
    listQuery: (params) =>
      listQueryOptions(keys.list(params), (signal) => api.list(params, signal)),
    detailQuery: (id) => detailQueryOptions(keys.detail(id), (signal) => api.get(id, signal)),
  }
}

export const branchResource = createOrgResource<OrgBranch, OrgBranchInput, BranchRow>({
  key: 'branches',
  path: '/settings/branches',
  singular: 'branch',
  plural: 'branches',
})

export const locationResource = createOrgResource<OrgLocation, OrgLocationInput, LocationRow>({
  key: 'locations',
  path: '/settings/locations',
  singular: 'location',
  plural: 'locations',
})

export const areaResource = createOrgResource<OrgArea, OrgAreaInput, AreaRow>({
  key: 'areas',
  path: '/settings/areas',
  singular: 'area',
  plural: 'areas',
})

export const jobTitleResource = createOrgResource<JobTitle, JobTitleInput, JobTitleRow>({
  key: 'job-titles',
  path: '/settings/job-titles',
  singular: 'job title',
  plural: 'job titles',
})

/** Enough rows to fill a dropdown of parents (locations of a company, areas of a location). */
export const OPTION_LIST_SIZE = 100
