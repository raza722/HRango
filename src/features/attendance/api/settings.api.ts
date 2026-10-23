import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AttendanceLogInput,
  AttendanceLogParams,
  AttendanceLogRow,
  AttendanceSettings,
  BreakTypeInput,
  BreakTypeRecord,
  FileImportResult,
  FileImportRow,
  GeoFenceSetting,
  GeoFenceSettingInput,
  Holiday,
  HolidayInput,
  IpRestriction,
  IpRestrictionInput,
  ListParams,
  MachineImportResult,
  MachineInfo,
  RestDayBatch,
  RestDayRow,
  SettingsLookups,
} from '../types/settings.types'

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function getData<T>(path: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, { signal })
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

const settingsPath = (path: string) => `/attendance/settings${path}`

/** The Settings lists with a CRUD set each: their records and inputs. */
export interface SettingsResources {
  breakTypes: { record: BreakTypeRecord; input: BreakTypeInput }
  ipRestrictions: { record: IpRestriction; input: IpRestrictionInput }
  geoFences: { record: GeoFenceSetting; input: GeoFenceSettingInput }
  holidays: { record: Holiday; input: HolidayInput }
}

export type SettingsResourceName = keyof SettingsResources

interface ResourceApi<TRecord, TInput> {
  list: (
    params: ListParams & { year?: string },
    signal?: AbortSignal,
  ) => Promise<Paginated<TRecord>>
  create: (input: TInput) => Promise<TRecord>
  update: (id: string, input: TInput) => Promise<TRecord>
  remove: (id: string) => Promise<void>
  setActive: (id: string, active: boolean) => Promise<TRecord>
}

/** A CRUD set for one Settings list (break types, IP restrictions…). */
function resource<TRecord, TInput>(path: string): ResourceApi<TRecord, TInput> {
  return {
    list: (params, signal) => getPage<TRecord>(settingsPath(path), params, signal),
    create: (input) => send<TRecord>('post', settingsPath(path), input),
    update: (id, input) => send<TRecord>('put', settingsPath(`${path}/${id}`), input),
    remove: async (id) => {
      await apiClient.delete(settingsPath(`${path}/${id}`))
    },
    setActive: (id, active) =>
      send<TRecord>('patch', settingsPath(`${path}/${id}/status`), { active }),
  }
}

const resources: {
  [N in SettingsResourceName]: ResourceApi<
    SettingsResources[N]['record'],
    SettingsResources[N]['input']
  >
} = {
  breakTypes: resource('/break-types'),
  ipRestrictions: resource('/ip-restrictions'),
  geoFences: resource('/geo-fences'),
  holidays: resource('/holidays'),
}

export const settingsApi = {
  config: (signal?: AbortSignal) => getData<AttendanceSettings>(settingsPath('/config'), signal),
  saveConfig: (input: AttendanceSettings) =>
    send<AttendanceSettings>('put', settingsPath('/config'), input),
  lookups: (signal?: AbortSignal) => getData<SettingsLookups>(settingsPath('/lookups'), signal),
  /** The CRUD set of one Settings list, typed by its name. */
  resource: <N extends SettingsResourceName>(name: N) => resources[name],
  restDays: (params: ListParams, signal?: AbortSignal) =>
    getPage<RestDayRow>(settingsPath('/rest-days'), params, signal),
  restDayBatch: (id: string, signal?: AbortSignal) =>
    getData<RestDayBatch>(settingsPath(`/rest-days/batches/${id}`), signal),
  deleteRestDayBatch: async (id: string) => {
    await apiClient.delete(settingsPath(`/rest-days/batches/${id}`))
  },
  deleteRestDayRange: (from: string, to: string) =>
    send<{ deleted: number }>('post', settingsPath('/rest-days/delete-range'), { from, to }),
}

export const logsApi = {
  list: (params: AttendanceLogParams, signal?: AbortSignal) =>
    getPage<AttendanceLogRow>('/attendance/logs', params, signal),
  machines: (signal?: AbortSignal) => getData<MachineInfo[]>('/attendance/logs/machines', signal),
  create: (input: AttendanceLogInput) => send<{ id: string }>('post', '/attendance/logs', input),
  update: (id: string, input: AttendanceLogInput) =>
    send<{ id: string }>('put', `/attendance/logs/${id}`, input),
  remove: async (id: string) => {
    await apiClient.delete(`/attendance/logs/${id}`)
  },
  importMachines: (machineIds: string[]) =>
    send<MachineImportResult>('post', '/attendance/logs/import/machines', { machineIds }),
  importFile: (rows: FileImportRow[]) =>
    send<FileImportResult>('post', '/attendance/logs/import/file', { rows }),
}

export const settingsKeys = {
  all: ['attendance', 'settings'] as const,
  config: () => [...settingsKeys.all, 'config'] as const,
  lookups: () => [...settingsKeys.all, 'lookups'] as const,
  list: (name: SettingsResourceName | 'restDays', params: object) =>
    [...settingsKeys.all, name, compact(params)] as const,
  restDayBatch: (id: string) => [...settingsKeys.all, 'rest-day-batch', id] as const,
  logs: (params: AttendanceLogParams) => ['attendance', 'logs', compact(params)] as const,
  machines: () => ['attendance', 'logs', 'machines'] as const,
}

export const configQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.config(),
    queryFn: ({ signal }) => settingsApi.config(signal),
  })

export const settingsLookupsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.lookups(),
    queryFn: ({ signal }) => settingsApi.lookups(signal),
    staleTime: 5 * 60_000,
  })

export const resourceListQueryOptions = <N extends SettingsResourceName>(
  name: N,
  params: ListParams & { year?: string },
) =>
  queryOptions({
    queryKey: settingsKeys.list(name, params),
    queryFn: ({ signal }) => settingsApi.resource(name).list(params, signal),
    placeholderData: keepPreviousData,
  })

export const restDaysQueryOptions = (params: ListParams) =>
  queryOptions({
    queryKey: settingsKeys.list('restDays', params),
    queryFn: ({ signal }) => settingsApi.restDays(params, signal),
    placeholderData: keepPreviousData,
  })

export const attendanceLogsQueryOptions = (params: AttendanceLogParams) =>
  queryOptions({
    queryKey: settingsKeys.logs(params),
    queryFn: ({ signal }) => logsApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
