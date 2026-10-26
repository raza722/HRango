import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type { PunchLog } from '../types/attendance.types'
import type {
  AttendanceLogInput,
  AttendanceLogParams,
  FileImportResult,
  FileImportRow,
} from '../types/logs.types'
import { compact, downloadCsv, normalizePunch, toWire } from './attendance.api'

const BASE = '/attendance/logs'

const listQuery = (params: Omit<AttendanceLogParams, 'page' | 'pageSize'>) =>
  compact({
    fromDate: params.from,
    toDate: params.to,
    employeeId: params.employeeId,
    punchType: params.punchType,
    source: params.source,
    q: params.q,
  })

const body = (input: AttendanceLogInput) => ({
  employeeId: input.employeeId,
  punchedAt: toWire(input.punchedAt),
  punchType: input.punchType,
  breakTypeId: input.breakTypeId,
  remarks: input.remarks,
  rowVersion: input.rowVersion ?? null,
})

/** Attendance Logs: the punches (`/api/attendance/logs`). */
export const logsApi = {
  async list(params: AttendanceLogParams, signal?: AbortSignal): Promise<Paginated<PunchLog>> {
    const { data } = await apiClient.get<Paginated<PunchLog>>(BASE, {
      params: { ...listQuery(params), page: params.page, pageSize: params.pageSize },
      signal,
    })
    return { ...data, data: data.data.map(normalizePunch) }
  },
  async create(input: AttendanceLogInput): Promise<PunchLog> {
    const { data } = await apiClient.post<ApiItem<PunchLog>>(BASE, body(input))
    return normalizePunch(data.data)
  },
  async update(id: string, input: AttendanceLogInput): Promise<PunchLog> {
    const { data } = await apiClient.put<ApiItem<PunchLog>>(`${BASE}/${id}`, body(input))
    return normalizePunch(data.data)
  },
  /** Machine, dashboard and request punches cannot be deleted; they can be ignored. */
  async setIgnored(punch: PunchLog, isIgnored: boolean): Promise<PunchLog> {
    const { data } = await apiClient.patch<ApiItem<PunchLog>>(`${BASE}/${punch.id}/ignore`, {
      isIgnored,
      rowVersion: punch.rowVersion,
    })
    return normalizePunch(data.data)
  },
  async remove(punch: PunchLog): Promise<void> {
    await apiClient.delete(`${BASE}/${punch.id}`, { params: { rowVersion: punch.rowVersion } })
  },
  async importFile(rows: FileImportRow[]): Promise<FileImportResult> {
    const { data } = await apiClient.post<ApiItem<FileImportResult>>(`${BASE}/import`, {
      lines: rows.map((row) => ({ ...row, punchedAt: toWire(row.punchedAt) })),
    })
    return data.data
  },
  /** The API's CSV of the punches between two dates (at most 31 days). */
  download: (params: Omit<AttendanceLogParams, 'page' | 'pageSize'>) =>
    downloadCsv(
      `${BASE}/export`,
      listQuery(params),
      params.from === params.to
        ? `attendance-log-${params.from}.csv`
        : `attendance-log-${params.from}-${params.to}.csv`,
    ),
}

export const logsKeys = {
  all: ['attendance', 'logs'] as const,
  list: (params: AttendanceLogParams) => [...logsKeys.all, compact(params)] as const,
}

export const attendanceLogsQueryOptions = (params: AttendanceLogParams) =>
  queryOptions({
    queryKey: logsKeys.list(params),
    queryFn: ({ signal }) => logsApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
