import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  BasicSettings,
  BreakTypeInput,
  BreakTypeRecord,
  BulkDeleteResult,
  CityOption,
  CountryOption,
  EmployeeOption,
  GeoFenceSetting,
  GeoFenceSettingInput,
  Holiday,
  HolidayInput,
  IpRestriction,
  IpRestrictionInput,
  ListParams,
  LookupOption,
  OrgLookupKind,
  RestDayRangeDelete,
  RestDayRule,
  RestDayRuleInput,
  SchedulingSettings,
  StateOption,
} from '../types/settings.types'

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function getData<T>(path: string, signal?: AbortSignal, params?: object) {
  const { data } = await apiClient.get<ApiItem<T>>(path, {
    signal,
    ...(params ? { params: compact(params) } : {}),
  })
  return data.data
}

async function getPage<T>(path: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path, { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put' | 'patch', path: string, body: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path, body)
  return data.data
}

/** Extra filters a list takes (`year`, `isActive`…), next to page, pageSize and q. */
export type ListFilters = Record<string, string | number | boolean | undefined>

/** The Settings lists with a CRUD set each: their records and inputs. */
export interface SettingsResources {
  breakTypes: { record: BreakTypeRecord; input: BreakTypeInput }
  ipRestrictions: { record: IpRestriction; input: IpRestrictionInput }
  geoFences: { record: GeoFenceSetting; input: GeoFenceSettingInput }
  holidays: { record: Holiday; input: HolidayInput }
  restDays: { record: RestDayRule; input: RestDayRuleInput }
}

export type SettingsResourceName = keyof SettingsResources

interface ResourceApi<TRecord, TInput> {
  list: (params: ListParams & ListFilters, signal?: AbortSignal) => Promise<Paginated<TRecord>>
  get: (id: string, signal?: AbortSignal) => Promise<TRecord>
  create: (input: TInput) => Promise<TRecord>
  /** `input.rowVersion` is the version last read. */
  update: (id: string, input: TInput) => Promise<TRecord>
  remove: (id: string, rowVersion: string | null) => Promise<void>
}

/** A CRUD set for one Settings list; `normalize` fixes up what the API sends back. */
function resource<TRecord, TInput>(
  path: string,
  normalize: (record: TRecord) => TRecord = (record) => record,
): ResourceApi<TRecord, TInput> {
  return {
    list: async (params, signal) => {
      const page = await getPage<TRecord>(path, params, signal)
      return { ...page, data: page.data.map(normalize) }
    },
    get: async (id, signal) => normalize(await getData<TRecord>(`${path}/${id}`, signal)),
    create: async (input) => normalize(await send<TRecord>('post', path, input)),
    update: async (id, input) => normalize(await send<TRecord>('put', `${path}/${id}`, input)),
    remove: async (id, rowVersion) => {
      await apiClient.delete(`${path}/${id}`, rowVersion ? { params: { rowVersion } } : undefined)
    },
  }
}

/** Decimals may arrive as strings ("31.520400"). */
const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value)

function normalizeFence(fence: GeoFenceSetting): GeoFenceSetting {
  return {
    ...fence,
    centerLat: toNumber(fence.centerLat),
    centerLng: toNumber(fence.centerLng),
    radiusM: toNumber(fence.radiusM),
    polygonPoints: fence.polygonPoints ?? null,
  }
}

const resources: {
  [N in SettingsResourceName]: ResourceApi<
    SettingsResources[N]['record'],
    SettingsResources[N]['input']
  >
} = {
  breakTypes: resource('/scheduling/settings/break-types'),
  ipRestrictions: resource('/attendance/settings/ip-restrictions'),
  geoFences: resource('/attendance/settings/geo-fences', normalizeFence),
  holidays: resource('/scheduling/settings/holidays'),
  restDays: resource('/scheduling/settings/rest-days'),
}

export const settingsApi = {
  basic: (signal?: AbortSignal) => getData<BasicSettings>('/attendance/settings/basic', signal),
  saveBasic: (input: BasicSettings) =>
    send<BasicSettings>('put', '/attendance/settings/basic', input),
  /** Not in the API yet: only the mock API answers (see docs/backend-mapping). */
  scheduling: (signal?: AbortSignal) =>
    getData<SchedulingSettings>('/attendance/settings/scheduling', signal),
  saveScheduling: (input: SchedulingSettings) =>
    send<SchedulingSettings>('put', '/attendance/settings/scheduling', input),
  /** The CRUD set of one Settings list, typed by its name. */
  resource: <N extends SettingsResourceName>(name: N) => resources[name],
  deleteRestDayRange: (input: RestDayRangeDelete) =>
    send<BulkDeleteResult>('post', '/scheduling/settings/rest-days/delete-range', input),
}

/** Pickers: employees the screen's permission reaches, organisation units, places. */
export const lookupsApi = {
  /**
   * One page of the employees the screen's permission reaches (`GET /employees/lookup` →
   * `{data, meta}`), searched on the server by `q` (code or name). Pickers read it through
   * `useEmployeeLookup`, which pages on ("Load more").
   */
  employees: (
    permission: string,
    q: string | undefined,
    signal?: AbortSignal,
    page = 1,
    pageSize = 50,
  ): Promise<Paginated<EmployeeOption>> =>
    fetchEmployeeLookup<EmployeeOption>({ permission, q, page, pageSize }, signal),
  org: (kind: OrgLookupKind, signal?: AbortSignal) =>
    getData<LookupOption[]>(`/organisation/lookups/${kind}`, signal),
  countries: (signal?: AbortSignal) =>
    getData<CountryOption[]>('/organisation/geo/countries', signal),
  states: (countryId: string, signal?: AbortSignal) =>
    getData<StateOption[]>('/organisation/geo/states', signal, { countryId }),
  cities: (stateId: string, signal?: AbortSignal) =>
    getData<CityOption[]>('/organisation/geo/cities', signal, { stateId }),
}

export const settingsKeys = {
  all: ['attendance', 'settings'] as const,
  basic: () => [...settingsKeys.all, 'basic'] as const,
  scheduling: () => [...settingsKeys.all, 'scheduling'] as const,
  resource: (name: SettingsResourceName) => [...settingsKeys.all, name] as const,
  list: (name: SettingsResourceName, params: object) =>
    [...settingsKeys.resource(name), 'list', compact(params)] as const,
  detail: (name: SettingsResourceName, id: string) =>
    [...settingsKeys.resource(name), 'detail', id] as const,
  lookups: () => [...settingsKeys.all, 'lookups'] as const,
  org: (kind: OrgLookupKind) => [...settingsKeys.lookups(), 'org', kind] as const,
  countries: () => [...settingsKeys.lookups(), 'countries'] as const,
  states: (countryId: string) => [...settingsKeys.lookups(), 'states', countryId] as const,
  cities: (stateId: string) => [...settingsKeys.lookups(), 'cities', stateId] as const,
}

export const basicSettingsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.basic(),
    queryFn: ({ signal }) => settingsApi.basic(signal),
  })

export const resourceListQueryOptions = <N extends SettingsResourceName>(
  name: N,
  params: ListParams & ListFilters,
) =>
  queryOptions({
    queryKey: settingsKeys.list(name, params),
    queryFn: ({ signal }) => settingsApi.resource(name).list(params, signal),
    placeholderData: keepPreviousData,
  })

export const resourceQueryOptions = <N extends SettingsResourceName>(name: N, id: string) =>
  queryOptions({
    queryKey: settingsKeys.detail(name, id),
    queryFn: ({ signal }) => settingsApi.resource(name).get(id, signal),
  })
