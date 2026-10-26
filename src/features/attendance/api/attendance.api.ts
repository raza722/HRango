import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AttendanceBreak,
  ClockInput,
  ClockState,
  DayDetail,
  DayEditInput,
  DayKey,
  DaysOverview,
  HistoryEntry,
  LocalDateTime,
  OverviewPage,
  OverviewParams,
  ProcessInput,
  ProcessResult,
  PunchLog,
  SummaryParams,
  TimeSheetData,
  TimeSheetDay,
  TimeSheetParams,
} from '../types/attendance.types'

/** Leaves out empty values so equal filters share one cache entry. */
export function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

// --- wire <-> screen ---------------------------------------------------------------------------

/** `2026-10-20T09:05:00` → `2026-10-20T09:05` (the API sends seconds; the screens use minutes). */
export function fromWire(value: string): LocalDateTime
export function fromWire(value: string | null | undefined): LocalDateTime | null
export function fromWire(value: string | null | undefined): LocalDateTime | null {
  return value ? value.slice(0, 16) : null
}

/** `2026-10-20T09:05` → `2026-10-20T09:05:00`. */
export function toWire(value: LocalDateTime): string
export function toWire(value: LocalDateTime | null): string | null
export function toWire(value: LocalDateTime | null): string | null {
  if (!value) return null
  return value.length === 16 ? `${value}:00` : value
}

/** Decimals arrive as strings ("50.00"). */
const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value)

/**
 * Audit and record timestamps (`createdAt`, `performedAt`) are UTC without a zone; mark them as
 * UTC so the browser shows them in local time. Values that carry a zone are left alone.
 */
export function utcStamp(value: string | null | undefined): string | null {
  if (!value) return null
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
}

export function normalizeDay(day: TimeSheetDay): TimeSheetDay {
  return {
    ...day,
    expectedIn: fromWire(day.expectedIn),
    expectedOut: fromWire(day.expectedOut),
    firstIn: fromWire(day.firstIn),
    lastOut: fromWire(day.lastOut),
    penaltyPercentage: toNumber(day.penaltyPercentage),
    flags: day.flags,
  }
}

export function normalizePunch(punch: PunchLog): PunchLog {
  return {
    ...punch,
    punchedAt: fromWire(punch.punchedAt),
    latitude: toNumber(punch.latitude),
    longitude: toNumber(punch.longitude),
    photo: punch.photo ?? null,
    createdAt: utcStamp(punch.createdAt) ?? punch.createdAt,
    updatedAt: utcStamp(punch.updatedAt),
  }
}

function normalizeBreak(item: AttendanceBreak): AttendanceBreak {
  return { ...item, outAt: fromWire(item.outAt), inAt: fromWire(item.inAt) }
}

function normalizeClock(state: ClockState): ClockState {
  return {
    ...state,
    now: fromWire(state.now),
    lastPunchedAt: fromWire(state.lastPunchedAt),
    expectedIn: fromWire(state.expectedIn),
    expectedOut: fromWire(state.expectedOut),
  }
}

/** The status filter of the screens → `employeeStatus` of the API. */
const employeeStatus = (status: string | undefined) =>
  status && status !== 'all' ? status : undefined

const timeSheetQuery = (params: TimeSheetParams) =>
  compact({
    tab: params.scope,
    fromDate: params.from,
    toDate: params.to,
    employeeId: params.employeeId,
    departmentId: params.departmentId,
    employeeStatus: employeeStatus(params.status),
    dayStatus: params.dayStatus,
    flag: params.flag,
    q: params.search,
  })

const overviewQuery = (params: OverviewParams) =>
  compact({
    tab: params.scope,
    month: params.month,
    departmentId: params.departmentId,
    employeeStatus: employeeStatus(params.status),
    q: params.search,
  })

const dayPath = ({ employeeId, date }: DayKey) =>
  `/attendance/days/${encodeURIComponent(employeeId)}/${date}`

/** Saves a CSV the API produced (the export endpoints). */
export async function downloadCsv(path: string, params: object, fileName: string) {
  const { data } = await apiClient.get<Blob>(path, { params, responseType: 'blob' })
  const blob = data instanceof Blob ? data : new Blob([String(data)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** REST calls of the Attendance module (overview, time sheet, days, clock). */
export const attendanceApi = {
  async overview(params: OverviewParams, signal?: AbortSignal): Promise<OverviewPage> {
    const { data } = await apiClient.get<OverviewPage>('/attendance/overview', {
      params: { ...overviewQuery(params), page: params.page, pageSize: params.pageSize },
      signal,
    })
    return data
  },
  exportOverview: (params: OverviewParams) =>
    downloadCsv(
      '/attendance/overview/export',
      overviewQuery(params),
      `attendance-overview-${params.month}.csv`,
    ),

  async timeSheet(params: TimeSheetParams, signal?: AbortSignal): Promise<TimeSheetData> {
    const { data } = await apiClient.get<Paginated<TimeSheetDay>>('/attendance/time-sheet', {
      params: { ...timeSheetQuery(params), page: params.page, pageSize: params.pageSize },
      signal,
    })
    return { ...data, data: data.data.map(normalizeDay) }
  },
  exportTimeSheet: (params: TimeSheetParams) =>
    downloadCsv(
      '/attendance/time-sheet/export',
      timeSheetQuery(params),
      `time-sheet-${params.from}-${params.to}.csv`,
    ),

  async summary(params: SummaryParams, signal?: AbortSignal): Promise<DaysOverview> {
    const { data } = await apiClient.get<ApiItem<DaysOverview>>('/attendance/time-sheet/summary', {
      params: compact({
        tab: params.scope,
        fromDate: params.from,
        toDate: params.to,
        employeeId: params.employeeId,
      }),
      signal,
    })
    return data.data
  },

  async process(input: ProcessInput): Promise<ProcessResult> {
    const { data } = await apiClient.post<ApiItem<ProcessResult>>(
      '/attendance/time-sheet/process',
      input,
    )
    return data.data
  },

  async clock(signal?: AbortSignal): Promise<ClockState> {
    const { data } = await apiClient.get<ApiItem<ClockState>>('/attendance/clock', { signal })
    return normalizeClock(data.data)
  },
  async punchClock(input: ClockInput = {}): Promise<PunchLog> {
    const { data } = await apiClient.post<ApiItem<PunchLog>>('/attendance/clock', {
      source: 'web',
      ...input,
    })
    return normalizePunch(data.data)
  },

  async day(key: DayKey, signal?: AbortSignal): Promise<DayDetail> {
    const { data } = await apiClient.get<ApiItem<DayDetail>>(dayPath(key), { signal })
    return toDetail(data.data)
  },
  async updateDay(key: DayKey, input: DayEditInput): Promise<DayDetail> {
    const body = {
      ...input,
      expectedIn: toWire(input.expectedIn),
      expectedOut: toWire(input.expectedOut),
      firstIn: toWire(input.firstIn),
      lastOut: toWire(input.lastOut),
      breaks: input.breaks.map((item) => ({
        breakTypeId: item.breakTypeId,
        outAt: toWire(item.outAt),
        inAt: toWire(item.inAt),
      })),
    }
    const { data } = await apiClient.put<ApiItem<DayDetail>>(dayPath(key), body)
    return toDetail(data.data)
  },

  async history(key: DayKey, page: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<HistoryEntry>>(`${dayPath(key)}/history`, {
      params: { page, pageSize: 5 },
      signal,
    })
    return {
      ...data,
      data: data.data.map((entry) => ({ ...entry, performedAt: utcStamp(entry.performedAt) })),
    }
  },
}

function toDetail(detail: DayDetail): DayDetail {
  return {
    day: normalizeDay(detail.day),
    flags: detail.flags,
    breaks: detail.breaks.map(normalizeBreak),
    punches: detail.punches.map(normalizePunch),
  }
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  overviews: () => [...attendanceKeys.all, 'overview'] as const,
  overview: (params: OverviewParams) => [...attendanceKeys.overviews(), compact(params)] as const,
  timeSheets: () => [...attendanceKeys.all, 'time-sheet'] as const,
  timeSheet: (params: TimeSheetParams) =>
    [...attendanceKeys.timeSheets(), compact(params)] as const,
  summary: (params: SummaryParams) => [...attendanceKeys.all, 'summary', compact(params)] as const,
  clock: () => [...attendanceKeys.all, 'clock'] as const,
  day: (key: DayKey) => [...attendanceKeys.all, 'day', key.employeeId, key.date] as const,
  history: (key: DayKey, page: number) => [...attendanceKeys.day(key), 'history', page] as const,
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

export const summaryQueryOptions = (params: SummaryParams) =>
  queryOptions({
    queryKey: attendanceKeys.summary(params),
    queryFn: ({ signal }) => attendanceApi.summary(params, signal),
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
