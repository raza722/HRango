import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import { fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type { EmployeeLookupItem, OrgLookupItem, OrgLookupKind } from '../types/assets.types'

/*
 * Pickers the Assets and Off Boarding screens share: employees (`GET /employees/lookup`, the
 * people the caller reaches through the screen's own permission code, searched on the server
 * with `q` and paged) and organisation units (`GET /organisation/lookups/{kind}`).
 *
 * The screens' employee pickers are `EmployeeSearchSelectField` / the filters' `employee`
 * field (server search as you type, "Load more"); `lookupsApi.employees` reads one page.
 */

export interface EmployeeLookupParams {
  /** The permission code the screen itself requires, e.g. `assets.allocations.assign`. */
  permission: string
  /** Former employees too (lists and filters; not for new records). */
  includeInactive?: boolean | undefined
  /** Searches the code and the name. */
  q?: string | undefined
  page?: number | undefined
  /** 1–100 (default 50). */
  pageSize?: number | undefined
}

export const lookupsApi = {
  /** One page of `GET /employees/lookup` → `{data, meta}`. */
  employees: (params: EmployeeLookupParams, signal?: AbortSignal) =>
    fetchEmployeeLookup<EmployeeLookupItem>(params, signal),
  org: async (kind: OrgLookupKind, signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiItem<OrgLookupItem[]>>(
      `/organisation/lookups/${kind}`,
      { signal },
    )
    return data.data
  },
}

export const lookupKeys = {
  employees: (params: EmployeeLookupParams) =>
    [
      'lookups',
      'employees',
      params.permission,
      Boolean(params.includeInactive),
      params.q?.trim() ?? '',
      params.page ?? 1,
      params.pageSize ?? null,
    ] as const,
  org: (kind: OrgLookupKind) => ['lookups', 'organisation', kind] as const,
}

export const employeeLookupQueryOptions = (params: EmployeeLookupParams) =>
  queryOptions({
    queryKey: lookupKeys.employees(params),
    queryFn: ({ signal }) => lookupsApi.employees(params, signal),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

/** One page of employees (`data.data`, `data.meta`); `enabled: false` skips the call. */
export const useEmployeeLookup = (params: EmployeeLookupParams, enabled = true) =>
  useQuery({ ...employeeLookupQueryOptions(params), enabled })

export const useOrgLookup = (kind: OrgLookupKind) =>
  useQuery({
    queryKey: lookupKeys.org(kind),
    queryFn: ({ signal }) => lookupsApi.org(kind, signal),
    staleTime: 5 * 60_000,
  })

/** A person's second line in a picker: code and designation. */
export const personHint = (
  person: Pick<EmployeeLookupItem, 'code' | 'designationName' | 'jobTitleName'>,
) => [person.code, person.designationName ?? person.jobTitleName].filter((part) => part).join(' · ')

/** A picker option for a person: name, with code and designation as the hint. */
export const personOption = (person: EmployeeLookupItem) => ({
  value: person.id,
  label: person.name,
  hint: personHint(person),
})
