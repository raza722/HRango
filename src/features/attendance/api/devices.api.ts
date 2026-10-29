import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  BiometricDevice,
  DeviceEnrolment,
  DeviceImportResult,
  DeviceInput,
  DeviceListParams,
  DevicePunchLine,
  EnrolmentInput,
} from '../types/devices.types'
import { compact, utcStamp } from './attendance.api'

const BASE = '/attendance/settings/devices'
const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`

/** Numeric ids go out as numbers (the API's integers); a mock's readable id as it is. */
const toApiId = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)

function normalizeDevice(device: BiometricDevice): BiometricDevice {
  return {
    ...device,
    status: device.status === 'inactive' ? 'inactive' : 'active',
    lastSyncedAt: utcStamp(device.lastSyncedAt),
    createdAt: utcStamp(device.createdAt) ?? device.createdAt,
    updatedAt: utcStamp(device.updatedAt),
  }
}

const normalizeEnrolment = (row: DeviceEnrolment): DeviceEnrolment => ({
  ...row,
  createdAt: utcStamp(row.createdAt) ?? row.createdAt,
})

const deviceBody = (input: DeviceInput) => ({
  name: input.name,
  model: input.model,
  serialNo: input.serialNo,
  ipAddress: input.ipAddress,
  port: input.port,
  branchId: input.branchId ? toApiId(input.branchId) : null,
  address: input.address,
  status: input.status,
  rowVersion: input.rowVersion ?? null,
})

/** Settings → Biometric Devices (`/api/attendance/settings/devices`). */
export const devicesApi = {
  async list(params: DeviceListParams, signal?: AbortSignal): Promise<Paginated<BiometricDevice>> {
    const { data } = await apiClient.get<Paginated<BiometricDevice>>(BASE, {
      params: compact({
        q: params.q,
        branchId: params.branchId ? toApiId(params.branchId) : undefined,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      }),
      signal,
    })
    return { ...data, data: data.data.map(normalizeDevice) }
  },
  async get(id: string, signal?: AbortSignal): Promise<BiometricDevice> {
    const { data } = await apiClient.get<ApiItem<BiometricDevice>>(path(id), { signal })
    return normalizeDevice(data.data)
  },
  async create(input: DeviceInput): Promise<BiometricDevice> {
    const { data } = await apiClient.post<ApiItem<BiometricDevice>>(BASE, deviceBody(input))
    return normalizeDevice(data.data)
  },
  /** `input.rowVersion` is the version last read; a newer one answers 409. */
  async update(id: string, input: DeviceInput): Promise<BiometricDevice> {
    const { data } = await apiClient.put<ApiItem<BiometricDevice>>(path(id), deviceBody(input))
    return normalizeDevice(data.data)
  },
  /** Refused (409) while people are enrolled or the device has punches: set it Inactive instead. */
  async remove(device: Pick<BiometricDevice, 'id' | 'rowVersion'>): Promise<void> {
    await apiClient.delete(path(device.id), { params: { rowVersion: device.rowVersion } })
  },
  async enrolments(id: string, signal?: AbortSignal): Promise<DeviceEnrolment[]> {
    const { data } = await apiClient.get<ApiItem<DeviceEnrolment[]>>(`${path(id)}/enrolments`, {
      signal,
    })
    return data.data.map(normalizeEnrolment)
  },
  /** Replaces everyone on the device at once; answers the device (new rowVersion and count). */
  async saveEnrolments(
    device: Pick<BiometricDevice, 'id' | 'rowVersion'>,
    rows: readonly EnrolmentInput[],
  ): Promise<BiometricDevice> {
    const { data } = await apiClient.put<ApiItem<BiometricDevice>>(
      `${path(device.id)}/enrolments`,
      {
        enrolments: rows.map((row) => ({
          employeeId: toApiId(row.employeeId),
          deviceUserNo: row.deviceUserNo,
        })),
        rowVersion: device.rowVersion,
      },
    )
    return normalizeDevice(data.data)
  },
  /** Punch lines the device handed over: created, skipped (already there) or failed per line. */
  async importPunches(id: string, lines: readonly DevicePunchLine[]): Promise<DeviceImportResult> {
    const { data } = await apiClient.post<ApiItem<DeviceImportResult>>(`${path(id)}/punches`, {
      lines,
    })
    return data.data
  },
}

export const devicesKeys = {
  all: ['attendance', 'devices'] as const,
  lists: () => [...devicesKeys.all, 'list'] as const,
  list: (params: DeviceListParams) => [...devicesKeys.lists(), compact(params)] as const,
  detail: (id: string) => [...devicesKeys.all, 'detail', id] as const,
  enrolments: (id: string) => [...devicesKeys.all, 'enrolments', id] as const,
}

export const devicesListQueryOptions = (params: DeviceListParams) =>
  queryOptions({
    queryKey: devicesKeys.list(params),
    queryFn: ({ signal }) => devicesApi.list(params, signal),
    placeholderData: keepPreviousData,
  })

export const deviceQueryOptions = (id: string) =>
  queryOptions({
    queryKey: devicesKeys.detail(id),
    queryFn: ({ signal }) => devicesApi.get(id, signal),
  })

export const deviceEnrolmentsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: devicesKeys.enrolments(id),
    queryFn: ({ signal }) => devicesApi.enrolments(id, signal),
  })
