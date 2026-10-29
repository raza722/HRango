import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  ChildInput,
  ChildRow,
  Employee,
  EmployeeChildKind,
  EmployeeInput,
  EmployeeListParams,
  EmployeeStats,
  OrgLookupItem,
  OrgLookupKind,
} from '../types/employees.types'

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '' && value !== false,
    ),
  ) as Partial<T>
}

async function getItem<T>(url: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(url, { signal })
  return data.data
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(url, body)
  return data.data
}

const path = (id: string, rest = '') => `/employees/${encodeURIComponent(id)}${rest}`

/** Pages read for the tiles' gender counts (100 a page). */
const STATS_MAX_PAGES = 20

/** REST calls of `/employees…` (Talent Management → Employees). */
export const employeesApi = {
  /** `GET /employees?q&status&includeInactive&branchId&departmentId&designationId&page&pageSize`. */
  async list(params: EmployeeListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<Employee>>('/employees', {
      params: compact(params),
      signal,
    })
    return data
  },

  /**
   * The four tiles. The list has no gender filter, so Male / Female are counted over every page
   * of the working staff (100 a page, at most 2,000 people); Total is that list's total and On
   * Probation a `status=probation` page of one.
   */
  async stats(signal?: AbortSignal): Promise<EmployeeStats> {
    let male = 0
    let female = 0
    let total = 0
    let read = 0
    for (let page = 1; page <= STATS_MAX_PAGES; page += 1) {
      const result = await employeesApi.list({ page, pageSize: 100 }, signal)
      total = result.meta.total
      read += result.data.length
      for (const person of result.data) {
        if (person.gender === 'male') male += 1
        else if (person.gender === 'female') female += 1
      }
      if (page >= result.meta.totalPages || result.data.length === 0) break
    }
    const probation = await employeesApi.list({ status: 'probation', page: 1, pageSize: 1 }, signal)
    return { total, male, female, probation: probation.meta.total, complete: read >= total }
  },

  get: (id: string, signal?: AbortSignal) => getItem<Employee>(path(id), signal),
  create: (input: EmployeeInput) => send<Employee>('post', '/employees', input),
  update: (id: string, input: EmployeeInput) => send<Employee>('put', path(id), input),
  /** CNIC, which only identity holders may see and change. */
  saveIdentity: (id: string, cnic: string | null, rowVersion: string) =>
    send<Employee>('put', path(id, '/identity'), { cnic, rowVersion }),
  /** The photo: an upload's id (`POST /files` first), or null to remove it. */
  savePhoto: (id: string, fileId: string | null, rowVersion: string) =>
    send<Employee>('put', path(id, '/photo'), { fileId, rowVersion }),
  deactivate: (id: string, rowVersion: string) =>
    send<Employee>('patch', path(id, '/deactivate'), { rowVersion }),
  reactivate: (id: string, rowVersion: string) =>
    send<Employee>('patch', path(id, '/reactivate'), { rowVersion }),

  /** A child table of one person: `GET /employees/{id}/<kind>` → `{data: [...]}`. */
  children: <K extends EmployeeChildKind>(id: string, kind: K, signal?: AbortSignal) =>
    getItem<ChildRow<K>[]>(path(id, `/${kind}`), signal),
  createChild: <K extends EmployeeChildKind>(id: string, kind: K, input: ChildInput<K>) =>
    send<ChildRow<K>>('post', path(id, `/${kind}`), input),
  updateChild: <K extends EmployeeChildKind>(
    id: string,
    kind: K,
    rowId: string,
    input: ChildInput<K>,
  ) => send<ChildRow<K>>('put', path(id, `/${kind}/${encodeURIComponent(rowId)}`), input),
  /** Deletes send the row version last read (`?rowVersion=`). */
  async removeChild(id: string, kind: EmployeeChildKind, rowId: string, rowVersion: string) {
    await apiClient.delete(path(id, `/${kind}/${encodeURIComponent(rowId)}`), {
      params: { rowVersion },
    })
  },

  /** `GET /organisation/lookups/{kind}` (any signed-in user). */
  orgLookup: (kind: OrgLookupKind, signal?: AbortSignal) =>
    getItem<OrgLookupItem[]>(`/organisation/lookups/${kind}`, signal),
}

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), compact(params)] as const,
  stats: () => [...employeeKeys.all, 'stats'] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  children: (id: string, kind: EmployeeChildKind) =>
    [...employeeKeys.detail(id), 'children', kind] as const,
  org: (kind: OrgLookupKind) => [...employeeKeys.all, 'org-lookups', kind] as const,
}

export const employeeListQueryOptions = (params: EmployeeListParams) =>
  queryOptions({
    queryKey: employeeKeys.list(params),
    queryFn: ({ signal }) => employeesApi.list(params, signal),
    placeholderData: keepPreviousData,
  })

export const employeeStatsQueryOptions = () =>
  queryOptions({
    queryKey: employeeKeys.stats(),
    queryFn: ({ signal }) => employeesApi.stats(signal),
  })

export const employeeQueryOptions = (id: string) =>
  queryOptions({
    queryKey: employeeKeys.detail(id),
    queryFn: ({ signal }) => employeesApi.get(id, signal),
  })

export const employeeChildrenQueryOptions = <K extends EmployeeChildKind>(id: string, kind: K) =>
  queryOptions({
    queryKey: employeeKeys.children(id, kind),
    queryFn: ({ signal }) => employeesApi.children(id, kind, signal),
  })

export const orgLookupQueryOptions = (kind: OrgLookupKind) =>
  queryOptions({
    queryKey: employeeKeys.org(kind),
    queryFn: ({ signal }) => employeesApi.orgLookup(kind, signal),
    staleTime: 5 * 60_000,
  })
