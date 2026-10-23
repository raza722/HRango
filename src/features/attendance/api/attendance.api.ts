import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AbsenceInput,
  AttendanceComment,
  AttendanceLookups,
  ClockState,
  DayDetail,
  DayEditInput,
  DayKey,
  DaysOverview,
  HistoryEntry,
  MissingPunchInput,
  OvertimeInput,
  OverviewPage,
  OverviewParams,
  PunchLog,
  RelaxationInput,
  TimeSheetData,
  TimeSheetDay,
  TimeSheetParams,
} from '../types/attendance.types'

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

const dayPath = ({ employeeId, date }: DayKey) =>
  `/attendance/days/${encodeURIComponent(employeeId)}/${date}`

/** REST calls of the Attendance module. */
export const attendanceApi = {
  async overview(params: OverviewParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<OverviewPage>('/attendance/overview', {
      params: compact(params),
      signal,
    })
    return data
  },
  async timeSheet(params: TimeSheetParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<TimeSheetData>('/attendance/time-sheet', {
      params: compact(params),
      signal,
    })
    return data
  },
  daysOverview: (employeeId: string | undefined, signal?: AbortSignal) =>
    getData<DaysOverview>('/attendance/days-overview', { employeeId }, signal),
  lookups: (signal?: AbortSignal) =>
    getData<AttendanceLookups>('/attendance/lookups', undefined, signal),
  clock: (signal?: AbortSignal) => getData<ClockState>('/attendance/clock', undefined, signal),
  punchClock: () => postData<ClockState>('/attendance/clock', {}),

  day: (key: DayKey, signal?: AbortSignal) => getData<DayDetail>(dayPath(key), undefined, signal),
  async updateDay(key: DayKey, input: DayEditInput) {
    const { data } = await apiClient.put<ApiItem<TimeSheetDay>>(dayPath(key), input)
    return data.data
  },
  addMissingPunch: (key: DayKey, input: MissingPunchInput) =>
    postData<TimeSheetDay>(`${dayPath(key)}/missing-punch`, input),
  applyRelaxation: (key: DayKey, input: RelaxationInput) =>
    postData<TimeSheetDay>(`${dayPath(key)}/relaxation`, input),
  markAbsence: (key: DayKey, input: AbsenceInput) =>
    postData<TimeSheetDay>(`${dayPath(key)}/absence`, input),
  approveOvertime: (key: DayKey, input: OvertimeInput) =>
    postData<TimeSheetDay>(`${dayPath(key)}/overtime`, input),

  async history(key: DayKey, page: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<HistoryEntry>>(`${dayPath(key)}/history`, {
      params: { page, pageSize: 5 },
      signal,
    })
    return data
  },
  logs: (key: DayKey, signal?: AbortSignal) =>
    getData<PunchLog[]>(`${dayPath(key)}/logs`, undefined, signal),
  addComment: (key: DayKey, text: string) =>
    postData<AttendanceComment>(`${dayPath(key)}/comments`, { text }),
  async deleteComment(key: DayKey, commentId: string) {
    await apiClient.delete(`${dayPath(key)}/comments/${commentId}`)
  },
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  overviews: () => [...attendanceKeys.all, 'overview'] as const,
  overview: (params: OverviewParams) => [...attendanceKeys.overviews(), compact(params)] as const,
  timeSheets: () => [...attendanceKeys.all, 'time-sheet'] as const,
  timeSheet: (params: TimeSheetParams) =>
    [...attendanceKeys.timeSheets(), compact(params)] as const,
  daysOverview: (employeeId: string | undefined) =>
    [...attendanceKeys.all, 'days-overview', employeeId ?? 'me'] as const,
  lookups: () => [...attendanceKeys.all, 'lookups'] as const,
  clock: () => [...attendanceKeys.all, 'clock'] as const,
  day: (key: DayKey) => [...attendanceKeys.all, 'day', key.employeeId, key.date] as const,
  history: (key: DayKey, page: number) => [...attendanceKeys.day(key), 'history', page] as const,
  logs: (key: DayKey) => [...attendanceKeys.day(key), 'logs'] as const,
}

export const overviewQueryOptions = (params: OverviewParams) =>
  queryOptions({
    queryKey: attendanceKeys.overview(params),
    queryFn: ({ signal }) => attendanceApi.overview(params, signal),
    placeholderData: keepPreviousData,
  })

export const timeSheetQueryOptions = (params: TimeSheetParams) =>
  queryOptions({
    queryKey: attendanceKeys.timeSheet(params),
    queryFn: ({ signal }) => attendanceApi.timeSheet(params, signal),
    placeholderData: keepPreviousData,
  })

export const daysOverviewQueryOptions = (employeeId: string | undefined) =>
  queryOptions({
    queryKey: attendanceKeys.daysOverview(employeeId),
    queryFn: ({ signal }) => attendanceApi.daysOverview(employeeId, signal),
  })

export const attendanceLookupsQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.lookups(),
    queryFn: ({ signal }) => attendanceApi.lookups(signal),
    staleTime: 5 * 60_000,
  })

export const clockQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.clock(),
    queryFn: ({ signal }) => attendanceApi.clock(signal),
  })

export const dayQueryOptions = (key: DayKey) =>
  queryOptions({
    queryKey: attendanceKeys.day(key),
    queryFn: ({ signal }) => attendanceApi.day(key, signal),
  })

export const historyQueryOptions = (key: DayKey, page: number) =>
  queryOptions({
    queryKey: attendanceKeys.history(key, page),
    queryFn: ({ signal }) => attendanceApi.history(key, page, signal),
    placeholderData: keepPreviousData,
  })

export const logsQueryOptions = (key: DayKey) =>
  queryOptions({
    queryKey: attendanceKeys.logs(key),
    queryFn: ({ signal }) => attendanceApi.logs(key, signal),
  })
