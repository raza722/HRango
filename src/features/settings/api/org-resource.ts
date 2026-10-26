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

/**
 * Query string of a Control Panel list. Filters narrow it to one parent. `search` is sent as
 * `?q=`. Every list covers the active company only (the API has no company filter).
 */
export interface OrgListParams extends PageParams {
  search?: string | undefined
  /** Areas and branches of one location. */
  locationId?: string | undefined
  /** Branches of one area. */
  areaId?: string | undefined
}

export interface OrgResourceConfig {
  /** Query-key segment, e.g. `branches`. */
  key: string
  /** API path under the base URL, e.g. `/organisation/branches`. */
  path: string
  /** Permission code prefix: `<permission>.view|create|edit|delete`. */
  permission: string
  /** Lower-case names for messages: "branch" / "branches". */
  singular: string
  plural: string
}

/** Every record the API sends carries its `rowVersion` (sent back to edit or delete it). */
interface Versioned {
  id: string
  name: string
  rowVersion: string
}

/**
 * A Control Panel record type (Branch, Location, Area, Job Title): its REST
 * calls, query keys and query options. Every list shares the same shape, so
 * the hooks and list page are written once against this.
 */
export interface OrgResource<
  TRecord extends Versioned,
  TInput,
  TRow extends Versioned,
> extends OrgResourceConfig {
  api: {
    list: (params: OrgListParams, signal?: AbortSignal) => Promise<Paginated<TRow>>
    get: (id: string, signal?: AbortSignal) => Promise<TRecord>
    create: (input: TInput) => Promise<TRecord>
    /** `rowVersion` is the one last read; a stale one is refused with 409. */
    update: (id: string, input: TInput, rowVersion: string) => Promise<TRecord>
    remove: (id: string, rowVersion: string) => Promise<void>
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
  if (params.locationId) result.locationId = params.locationId
  if (params.areaId) result.areaId = params.areaId
  return result
}

/** The query string the API reads: `?page&pageSize&q&locationId&areaId`. */
function toQueryString({ search, ...rest }: OrgListParams): Record<string, string | number> {
  const query: Record<string, string | number> = { ...rest }
  if (search) query.q = search
  return query
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

export function createOrgResource<TRecord extends Versioned, TInput, TRow extends Versioned>(
  config: OrgResourceConfig,
): OrgResource<TRecord, TInput, TRow> {
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
        params: toQueryString(compactParams(params)),
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
    async update(id: string, input: TInput, rowVersion: string) {
      const { data } = await apiClient.put<ApiItem<TRecord>>(`${path}/${id}`, {
        ...input,
        rowVersion,
      })
      return data.data
    },
    async remove(id: string, rowVersion: string) {
      await apiClient.delete(`${path}/${id}`, { params: { rowVersion } })
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
  path: '/organisation/branches',
  permission: 'organisation.branches',
  singular: 'branch',
  plural: 'branches',
})

export const locationResource = createOrgResource<OrgLocation, OrgLocationInput, LocationRow>({
  key: 'locations',
  path: '/organisation/locations',
  permission: 'organisation.locations',
  singular: 'location',
  plural: 'locations',
})

export const areaResource = createOrgResource<OrgArea, OrgAreaInput, AreaRow>({
  key: 'areas',
  path: '/organisation/areas',
  permission: 'organisation.areas',
  singular: 'area',
  plural: 'areas',
})

export const jobTitleResource = createOrgResource<JobTitle, JobTitleInput, JobTitleRow>({
  key: 'job-titles',
  path: '/organisation/job-titles',
  permission: 'organisation.job_titles',
  singular: 'job title',
  plural: 'job titles',
})

/** The most rows the API returns in one page (`pageSize` is capped at 100). */
export const OPTION_LIST_SIZE = 100
