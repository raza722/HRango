import { queryOptions } from '@tanstack/react-query'

import { fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiItem, Paginated } from '@/types/api'

import type { NamedRef, PersonRef } from '../types/requests.types'

/*
 * Pickers the request forms and filters share, read from the modules that own
 * them: employees (`GET /employees/lookup?permission=` lists whom the caller may
 * reach through the screen's own permission), organisation units
 * (`GET /organisation/lookups/<kind>`) and the caller's delegators (Request
 * Settings → Delegation).
 */

/** A `GET /employees/lookup` row. */
export interface EmployeeOption {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string
  status: string
  photoUrl: string | null
}

/** A person on the forms and filters. */
export interface PersonOption extends PersonRef {
  department: string
  departmentId: string | null
  designation: string
  branch: string | null
  branchId: string | null
  active: boolean
  photoUrl: string | null
}

export const toPersonOption = (row: EmployeeOption): PersonOption => ({
  id: row.id,
  name: row.name,
  code: row.code,
  department: row.departmentName ?? '—',
  departmentId: row.departmentId ?? null,
  designation: row.jobTitleName ?? row.designationName ?? '—',
  branch: row.branchName,
  branchId: row.branchId ?? null,
  active: row.status === 'active',
  photoUrl: row.photoUrl,
})

/** `GET /organisation/lookups/<kind>`. */
export type OrgLookupKind =
  | 'locations'
  | 'areas'
  | 'branches'
  | 'departments'
  | 'divisions'
  | 'cost-centers'
  | 'designations'
  | 'job-titles'
  | 'grades'
  | 'job-levels'
  | 'employee-groups'
  | 'employment-types'

export interface OrgOption extends NamedRef {
  code: string | null
  parentId: string | null
}

export const lookupsApi = {
  /**
   * One page of the employees the caller reaches through `permission` (e.g.
   * `requests.leave.create` for whom they may file for), searched with `q` (code or
   * name). The API pages them (`page`, `pageSize` up to 100; default the first 100), so
   * a picker searches the server (`useEmployeeLookupSearch`) instead of holding everyone.
   */
  async employees(
    permission: string,
    params: {
      q?: string
      includeInactive?: boolean
      page?: number
      pageSize?: number
      /** The page size (older name of `pageSize`). */
      limit?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<PersonOption[]> {
    const { data } = await fetchEmployeeLookup<EmployeeOption>(
      {
        permission,
        q: params.q,
        includeInactive: params.includeInactive,
        page: params.page,
        pageSize: Math.min(100, params.pageSize ?? params.limit ?? 100),
      },
      signal,
    )
    return data.map(toPersonOption)
  },
  async org(kind: OrgLookupKind, parentId?: string, signal?: AbortSignal): Promise<OrgOption[]> {
    const { data } = await apiClient.get<ApiItem<OrgOption[]>>(`/organisation/lookups/${kind}`, {
      params: parentId ? { parentId } : undefined,
      signal,
    })
    return data.data
  },
  /**
   * People whose approvals of `requestType` pass to the signed-in person
   * (active delegations). Needs Request Settings → Delegation; empty without it.
   */
  async delegators(requestType: string, signal?: AbortSignal): Promise<PersonRef[]> {
    const user = useAuthStore.getState().user
    if (!user?.employeeId || !can(user, 'requests.settings.delegations.view')) return []
    const { data } = await apiClient.get<
      Paginated<{ delegatorId: string; delegatorName: string | null }>
    >('/requests/settings/delegations', {
      params: { delegateeId: user.employeeId, requestType, isActive: true, pageSize: 100 },
      signal,
    })
    const seen = new Map<string, PersonRef>()
    for (const row of data.data) {
      seen.set(row.delegatorId, { id: row.delegatorId, name: row.delegatorName ?? '—', code: '' })
    }
    return [...seen.values()]
  },
}

export const lookupKeys = {
  all: ['requests', 'lookups'] as const,
  employees: (permission: string) => [...lookupKeys.all, 'employees', permission] as const,
  org: (kind: OrgLookupKind, parentId?: string) =>
    [...lookupKeys.all, 'org', kind, parentId ?? ''] as const,
  delegators: (requestType: string) => [...lookupKeys.all, 'delegators', requestType] as const,
}

/** The first page (100) of the people `permission` reaches; pickers search the server instead. */
export const employeeOptionsQuery = (permission: string) =>
  queryOptions({
    queryKey: lookupKeys.employees(permission),
    queryFn: ({ signal }) => lookupsApi.employees(permission, {}, signal),
    staleTime: 5 * 60_000,
  })

export const orgOptionsQuery = (kind: OrgLookupKind, parentId?: string) =>
  queryOptions({
    queryKey: lookupKeys.org(kind, parentId),
    queryFn: ({ signal }) => lookupsApi.org(kind, parentId, signal),
    staleTime: 5 * 60_000,
  })

/** The signed-in person as a request's employee (null for a user with no employee record). */
export function currentPerson(): PersonRef | null {
  const user = useAuthStore.getState().user
  if (!user?.employeeId) return null
  return { id: user.employeeId, name: user.name, code: '' }
}
