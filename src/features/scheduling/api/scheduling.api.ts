import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  ActiveShift,
  ApplyDefaultShiftInput,
  BatchResult,
  BoardPage,
  BoardParams,
  CreateScheduleInput,
  DeleteScheduleInput,
  EmployeeFilters,
  EntryPatch,
  GeoFence,
  GeoFenceInput,
  ImportRow,
  PickableEmployee,
  RestDayInput,
  ScheduleEntry,
  SchedulingLookups,
  SwapInput,
} from '../types/scheduling.types'

/** Leaves out empty values so equal filters share one cache entry. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function getData<T>(path: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, {
    params: params ? compact(params) : undefined,
    signal,
  })
  return data.data
}

async function postData<T>(path: string, body: unknown) {
  const { data } = await apiClient.post<ApiItem<T>>(path, body)
  return data.data
}

/** REST calls of the Scheduling module. */
export const schedulingApi = {
  async board(params: BoardParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<BoardPage>('/scheduling/board', {
      params: compact(params),
      signal,
    })
    return data
  },
  activeShift: (signal?: AbortSignal) =>
    getData<ActiveShift>('/scheduling/active-shift', undefined, signal),
  lookups: (signal?: AbortSignal) =>
    getData<SchedulingLookups>('/scheduling/lookups', undefined, signal),
  employees: (filters: EmployeeFilters & { search?: string }, signal?: AbortSignal) =>
    getData<PickableEmployee[]>('/scheduling/employees', filters, signal),
  entry: (id: string, signal?: AbortSignal) =>
    getData<ScheduleEntry>(`/scheduling/entries/${id}`, undefined, signal),
  geoFences: (signal?: AbortSignal) => getData<GeoFence[]>('/geo-fences', undefined, signal),

  createSchedule: (input: CreateScheduleInput) =>
    postData<BatchResult>('/scheduling/schedules', input),
  applyDefault: (input: ApplyDefaultShiftInput) =>
    postData<BatchResult>('/scheduling/apply-default', input),
  deleteRange: (input: DeleteScheduleInput) =>
    postData<BatchResult>('/scheduling/delete-range', input),
  createRestDays: (input: RestDayInput) => postData<BatchResult>('/scheduling/rest-days', input),
  async updateEntry(id: string, patch: EntryPatch) {
    const { data } = await apiClient.patch<ApiItem<ScheduleEntry>>(
      `/scheduling/entries/${id}`,
      patch,
    )
    return data.data
  },
  bulkUpdate: (ids: string[], patch: EntryPatch) =>
    postData<BatchResult>('/scheduling/entries/bulk-update', { ids, patch }),
  bulkDelete: (ids: string[]) => postData<BatchResult>('/scheduling/entries/bulk-delete', { ids }),
  async deleteEntry(id: string) {
    await apiClient.delete(`/scheduling/entries/${id}`)
  },
  swap: (input: SwapInput) => postData<BatchResult>('/scheduling/entries/swap', input),
  importRows: (rows: ImportRow[]) => postData<BatchResult>('/scheduling/import', { rows }),
  createGeoFence: (input: GeoFenceInput) => postData<GeoFence>('/geo-fences', input),
}

export const schedulingKeys = {
  all: ['scheduling'] as const,
  boards: () => [...schedulingKeys.all, 'board'] as const,
  board: (params: BoardParams) => [...schedulingKeys.boards(), compact(params)] as const,
  activeShift: () => [...schedulingKeys.all, 'active-shift'] as const,
  lookups: () => [...schedulingKeys.all, 'lookups'] as const,
  employees: (filters: object) => [...schedulingKeys.all, 'employees', compact(filters)] as const,
  entry: (id: string) => [...schedulingKeys.all, 'entry', id] as const,
  geoFences: () => ['geo-fences'] as const,
}

export const boardQueryOptions = (params: BoardParams) =>
  queryOptions({
    queryKey: schedulingKeys.board(params),
    queryFn: ({ signal }) => schedulingApi.board(params, signal),
    placeholderData: keepPreviousData,
  })

export const activeShiftQueryOptions = () =>
  queryOptions({
    queryKey: schedulingKeys.activeShift(),
    queryFn: ({ signal }) => schedulingApi.activeShift(signal),
  })

export const lookupsQueryOptions = () =>
  queryOptions({
    queryKey: schedulingKeys.lookups(),
    queryFn: ({ signal }) => schedulingApi.lookups(signal),
    staleTime: 5 * 60_000,
  })

export const employeesQueryOptions = (filters: EmployeeFilters & { search?: string }) =>
  queryOptions({
    queryKey: schedulingKeys.employees(filters),
    queryFn: ({ signal }) => schedulingApi.employees(filters, signal),
    placeholderData: keepPreviousData,
  })

export const entryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: schedulingKeys.entry(id),
    queryFn: ({ signal }) => schedulingApi.entry(id, signal),
  })

export const geoFencesQueryOptions = () =>
  queryOptions({
    queryKey: schedulingKeys.geoFences(),
    queryFn: ({ signal }) => schedulingApi.geoFences(signal),
    staleTime: 60_000,
  })
