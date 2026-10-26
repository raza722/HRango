import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query'

import { EMPLOYEE_LOOKUP_PAGE_SIZE, fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  BoardFilters,
  BoardPage,
  BoardParams,
  BulkDeleteInput,
  BulkDeleteResult,
  BulkEditInput,
  BulkEditResult,
  DefaultShiftInput,
  EmployeeFilters,
  GeoFenceOption,
  LookupItem,
  OrgLookupKind,
  PickableEmployee,
  RestDayRangeDeleteInput,
  RestDayRule,
  RestDayRuleInput,
  ScheduleBatchInput,
  ScheduleBatchResult,
  ScheduleDetail,
  ScheduleInput,
  SchedulingOption,
  SwapInput,
  YearPage,
  YearParams,
} from '../types/scheduling.types'

/** Leaves out empty values so equal filters share one cache entry. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

/** The planner's filters as query parameters (`search` is `q`). */
function filterParams({ search, ...filters }: BoardFilters) {
  return compact({ q: search, ...filters })
}

async function postData<T>(path: string, body: unknown) {
  const { data } = await apiClient.post<ApiItem<T>>(path, body)
  return data.data
}

const SCHEDULES = '/scheduling/schedules'

/** REST calls of the Scheduling module (`/api/scheduling/...`) and the pickers it uses. */
export const schedulingApi = {
  async board({ scope, from, to, page, pageSize, ...filters }: BoardParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<BoardPage>(SCHEDULES, {
      params: { tab: scope, from, to, page, pageSize, ...filterParams(filters) },
      signal,
    })
    return data
  },
  async year({ scope, year, page, pageSize, ...filters }: YearParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<YearPage>(`${SCHEDULES}/year`, {
      params: { tab: scope, year, page, pageSize, ...filterParams(filters) },
      signal,
    })
    return data
  },
  /** The filtered board as CSV text (one line per employee and date). */
  async exportCsv(params: Omit<BoardParams, 'page' | 'pageSize'>) {
    const { scope, from, to, ...filters } = params
    const { data } = await apiClient.get<string>(`${SCHEDULES}/export`, {
      params: { tab: scope, from, to, ...filterParams(filters) },
      responseType: 'text',
      headers: { Accept: 'text/csv' },
    })
    return data
  },
  async schedule(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<ScheduleDetail>>(`${SCHEDULES}/${id}`, { signal })
    return data.data
  },
  createSchedule: (input: ScheduleInput) => postData<ScheduleDetail>(SCHEDULES, input),
  async updateSchedule(id: string, input: ScheduleInput) {
    const { data } = await apiClient.put<ApiItem<ScheduleDetail>>(`${SCHEDULES}/${id}`, input)
    return data.data
  },
  async deleteSchedule(id: string, rowVersion?: string) {
    await apiClient.delete(`${SCHEDULES}/${id}`, { params: compact({ rowVersion }) })
  },
  swap: (id: string, input: SwapInput) =>
    postData<ScheduleDetail>(`${SCHEDULES}/${id}/swap`, input),
  createBatch: (input: ScheduleBatchInput) =>
    postData<ScheduleBatchResult>(`${SCHEDULES}/batches`, input),
  applyDefaultShift: (input: DefaultShiftInput) =>
    postData<ScheduleBatchResult>(`${SCHEDULES}/default-shift`, input),
  bulkDelete: (input: BulkDeleteInput) =>
    postData<BulkDeleteResult>(`${SCHEDULES}/bulk-delete`, input),
  bulkEdit: (input: BulkEditInput) => postData<BulkEditResult>(`${SCHEDULES}/bulk-edit`, input),

  createRestDayRule: (input: RestDayRuleInput) =>
    postData<RestDayRule>('/scheduling/settings/rest-days', input),
  deleteRestDayRange: (input: RestDayRangeDeleteInput) =>
    postData<BulkDeleteResult>('/scheduling/settings/rest-days/delete-range', input),

  async options(kind: 'time-slots' | 'break-types' | 'roster-groups', signal?: AbortSignal) {
    const { data } = await apiClient.get<{ data: SchedulingOption[] }>(
      `/scheduling/options/${kind}`,
      { signal },
    )
    return data.data
  },
  /** Active geo fences (Attendance settings; needs its view permission). */
  async geoFences(signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<GeoFenceOption>>(
      '/attendance/settings/geo-fences',
      { params: { isActive: true, page: 1, pageSize: 100 }, signal },
    )
    return data.data
  },
  async orgLookup(kind: OrgLookupKind, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LookupItem[]>>(`/organisation/lookups/${kind}`, {
      signal,
    })
    return data.data
  },
  /**
   * One page of the people the caller reaches through `permission` (`GET /employees/lookup`):
   * `q` searches code and name on the server, `branchId`/`departmentId` narrow it, and
   * `page`/`pageSize` (≤ 100) page it → `{data, meta}`.
   */
  employees(
    permission: string,
    { search, branchId, departmentId }: EmployeeFilters,
    signal?: AbortSignal,
    page = 1,
    pageSize = EMPLOYEE_LOOKUP_PAGE_SIZE,
  ): Promise<Paginated<PickableEmployee>> {
    return fetchEmployeeLookup<PickableEmployee>(
      { permission, q: search?.trim(), branchId, departmentId, page, pageSize },
      signal,
    )
  },
}

export const schedulingKeys = {
  all: ['scheduling'] as const,
  boards: () => [...schedulingKeys.all, 'board'] as const,
  board: (params: BoardParams) => [...schedulingKeys.boards(), compact(params)] as const,
  year: (params: YearParams) => [...schedulingKeys.boards(), 'year', compact(params)] as const,
  activeShift: (day: string) => [...schedulingKeys.all, 'active-shift', day] as const,
  schedule: (id: string) => [...schedulingKeys.all, 'schedule', id] as const,
  options: (kind: string) => [...schedulingKeys.all, 'options', kind] as const,
  employees: (permission: string, filters: object) =>
    [...schedulingKeys.all, 'employees', permission, compact(filters)] as const,
  orgLookup: (kind: OrgLookupKind) => ['organisation', 'lookups', kind] as const,
  geoFences: () => ['geo-fences'] as const,
}

export const boardQueryOptions = (params: BoardParams) =>
  queryOptions({
    queryKey: schedulingKeys.board(params),
    queryFn: ({ signal }) => schedulingApi.board(params, signal),
    placeholderData: keepPreviousData,
  })

export const yearQueryOptions = (params: YearParams) =>
  queryOptions({
    queryKey: schedulingKeys.year(params),
    queryFn: ({ signal }) => schedulingApi.year(params, signal),
    placeholderData: keepPreviousData,
  })

export const scheduleQueryOptions = (id: string) =>
  queryOptions({
    queryKey: schedulingKeys.schedule(id),
    queryFn: ({ signal }) => schedulingApi.schedule(id, signal),
  })

export const optionsQueryOptions = (kind: 'time-slots' | 'break-types' | 'roster-groups') =>
  queryOptions({
    queryKey: schedulingKeys.options(kind),
    queryFn: ({ signal }) => schedulingApi.options(kind, signal),
    staleTime: 60_000,
  })

export const geoFencesQueryOptions = () =>
  queryOptions({
    queryKey: schedulingKeys.geoFences(),
    queryFn: ({ signal }) => schedulingApi.geoFences(signal),
    staleTime: 60_000,
  })

export const orgLookupQueryOptions = (kind: OrgLookupKind) =>
  queryOptions({
    queryKey: schedulingKeys.orgLookup(kind),
    queryFn: ({ signal }) => schedulingApi.orgLookup(kind, signal),
    staleTime: 5 * 60_000,
  })

/** Select Employees' people for the filters, a page at a time ("Load more" reads the next). */
export const employeesQueryOptions = (permission: string, filters: EmployeeFilters) =>
  infiniteQueryOptions({
    queryKey: schedulingKeys.employees(permission, filters),
    queryFn: ({ pageParam, signal }) =>
      schedulingApi.employees(permission, filters, signal, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    placeholderData: keepPreviousData,
  })
