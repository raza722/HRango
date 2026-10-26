import { queryOptions } from '@tanstack/react-query'

import { fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  City,
  Company,
  Country,
  Employee,
  GeneralSettings,
  GeneralSettingsInput,
  GeoPlace,
  LookupItem,
  State,
} from '../types/settings.types'
import { SETTINGS_QUERY_ROOT } from './org-resource'

type QueryParams = Record<string, string | number | boolean>

async function getData<T>(path: string, params?: QueryParams, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, { params, signal })
  return data.data
}

/** Reference lists change rarely; keep them for the whole session. */
const STATIC = { staleTime: Number.POSITIVE_INFINITY } as const

/** Picker lists any signed-in user may read: `GET /organisation/lookups/{kind}`. */
export type LookupKind =
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

/** `GET /employees/lookup` filters. */
export interface EmployeeLookupParams {
  /**
   * The code the screen itself requires (e.g. `organisation.branches.edit`): the list holds the
   * employees the user reaches through it. Defaults to `employees.directory.view` on the API.
   */
  permission?: string | undefined
  q?: string | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  includeInactive?: boolean | undefined
  page?: number | undefined
  /** 1–100 (default 50). */
  pageSize?: number | undefined
}

function compact(params: EmployeeLookupParams): QueryParams {
  const out: QueryParams = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') out[key] = value as string | number | boolean
  })
  return out
}

export const lookupKeys = {
  all: [SETTINGS_QUERY_ROOT, 'lookups'] as const,
  companies: () => [...lookupKeys.all, 'companies'] as const,
  employees: (params: EmployeeLookupParams = {}) =>
    [...lookupKeys.all, 'employees', compact(params)] as const,
  org: (kind: LookupKind, parentId = '') => [...lookupKeys.all, 'org', kind, parentId] as const,
  countries: () => [...lookupKeys.all, 'countries'] as const,
  states: (countryId: string) => [...lookupKeys.all, 'states', countryId] as const,
  /** Kept for older imports. */
  regions: (countryId: string) => lookupKeys.states(countryId),
  cities: (stateId: string) => [...lookupKeys.all, 'cities', stateId] as const,
  places: (query: string) => [...lookupKeys.all, 'places', query] as const,
}

/** Companies the user belongs to, for a company switcher (`isCurrent` marks the active one). */
export const companiesQueryOptions = () =>
  queryOptions({
    queryKey: lookupKeys.companies(),
    queryFn: ({ signal }) =>
      getData<Company[]>('/organisation/lookups/companies', undefined, signal),
    ...STATIC,
  })

/**
 * One page of employees (`GET /employees/lookup` → `{data, meta}`), searched on the server by
 * `q` (code or name). Pickers use `EmployeeSearchSelect`, which pages through as you type.
 */
export const employeesQueryOptions = (params: EmployeeLookupParams = {}) =>
  queryOptions({
    queryKey: lookupKeys.employees(params),
    queryFn: ({ signal }) => fetchEmployeeLookup<Employee>(params, signal),
    staleTime: 5 * 60_000,
  })

/** Ids and names of one organisation list; `parentId` narrows areas and branches to a location. */
export const orgLookupQueryOptions = (kind: LookupKind, parentId = '') =>
  queryOptions({
    queryKey: lookupKeys.org(kind, parentId),
    queryFn: ({ signal }) =>
      getData<LookupItem[]>(
        `/organisation/lookups/${kind}`,
        parentId ? { parentId } : undefined,
        signal,
      ),
    staleTime: 60_000,
  })

export const countriesQueryOptions = () =>
  queryOptions({
    queryKey: lookupKeys.countries(),
    queryFn: ({ signal }) => getData<Country[]>('/organisation/geo/countries', undefined, signal),
    ...STATIC,
  })

export const statesQueryOptions = (countryId: string) =>
  queryOptions({
    queryKey: lookupKeys.states(countryId),
    queryFn: ({ signal }) => getData<State[]>('/organisation/geo/states', { countryId }, signal),
    enabled: countryId !== '',
    ...STATIC,
  })

/** Kept for older imports. */
export const regionsQueryOptions = statesQueryOptions

export const citiesQueryOptions = (stateId: string) =>
  queryOptions({
    queryKey: lookupKeys.cities(stateId),
    queryFn: ({ signal }) => getData<City[]>('/organisation/geo/cities', { stateId }, signal),
    enabled: stateId !== '',
    ...STATIC,
  })

/**
 * "Search Location": places matching the text (needs at least two characters). Answered by the
 * mock API only; the real API has no geocoder (see `isMockApi` in `GeoLocationFields`).
 */
export const placesQueryOptions = (query: string) =>
  queryOptions({
    queryKey: lookupKeys.places(query.trim().toLowerCase()),
    queryFn: ({ signal }) => getData<GeoPlace[]>('/geo/search', { q: query.trim() }, signal),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

export const generalSettingsKeys = {
  all: [SETTINGS_QUERY_ROOT, 'general'] as const,
}

export const generalSettingsApi = {
  get: (signal?: AbortSignal) =>
    getData<GeneralSettings>('/organisation/general', undefined, signal),
  async update(input: GeneralSettingsInput): Promise<GeneralSettings> {
    const { data } = await apiClient.put<ApiItem<GeneralSettings>>('/organisation/general', input)
    return data.data
  },
  /** Sets (an uploaded image's id) or removes (null) the organisation's logo. */
  async setLogo(fileId: string | null): Promise<GeneralSettings> {
    const { data } = await apiClient.put<ApiItem<GeneralSettings>>('/organisation/general/logo', {
      fileId,
    })
    return data.data
  },
}

export const generalSettingsQueryOptions = () =>
  queryOptions({
    queryKey: generalSettingsKeys.all,
    queryFn: ({ signal }) => generalSettingsApi.get(signal),
  })
