import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { attendanceKeys } from '../api/attendance.api'
import {
  deviceEnrolmentsQueryOptions,
  deviceQueryOptions,
  devicesApi,
  devicesKeys,
  devicesListQueryOptions,
} from '../api/devices.api'
import type {
  BiometricDevice,
  DeviceInput,
  DeviceListParams,
  DevicePunchLine,
  EnrolmentInput,
} from '../types/devices.types'
import { useOrgLookup } from './use-attendance-settings'

/** Permission codes of Settings → Biometric Devices. */
export const DEVICE_CODES = {
  view: 'attendance.settings.devices.view',
  create: 'attendance.settings.devices.create',
  edit: 'attendance.settings.devices.edit',
  delete: 'attendance.settings.devices.delete',
  enrol: 'attendance.settings.devices.enrol',
  import: 'attendance.settings.devices.import',
} as const

/** One page of devices (`GET /attendance/settings/devices`). */
export function useDevices(params: DeviceListParams, enabled = true) {
  return useQuery({ ...devicesListQueryOptions(params), enabled })
}

/** One device; idle without an id. */
export function useDevice(id: string | null | undefined) {
  return useQuery({ ...deviceQueryOptions(id ?? ''), enabled: Boolean(id) })
}

/** The people enrolled on a device. */
export function useDeviceEnrolments(id: string, enabled = true) {
  return useQuery({ ...deviceEnrolmentsQueryOptions(id), enabled })
}

/** Branches for the form and the filter (`GET /organisation/lookups/branches`). */
export function useBranchOptions() {
  const { data, isPending } = useOrgLookup('branches')
  return {
    isPending,
    options: (data ?? []).map((branch) => ({ value: branch.id, label: branch.name })),
  }
}

/** When the page opened, for "not synced for N days" (render stays pure). */
export function useOpenedAt(): number {
  const [now] = useState(() => Date.now())
  return now
}

/**
 * Create (no id) or edit a device. Field errors stay with the form (no toast); the lists and
 * the record refetch.
 */
export function useSaveDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string | undefined
      input: DeviceInput
      /** The toast, when "saved" / "added" does not say it (e.g. "set to Inactive"). */
      message?: string
    }) => (id ? devicesApi.update(id, input) : devicesApi.create(input)),
    meta: { suppressErrorToast: true },
    onSuccess: async (device, { id, message }) => {
      toast.success(
        message ?? (id ? `${device.name} saved` : `${device.name} (${device.code}) added`),
      )
      queryClient.setQueryData(devicesKeys.detail(device.id), device)
      // Not the enrolments: an editor open on the same device keeps its unsaved changes.
      await queryClient.invalidateQueries({ queryKey: devicesKeys.lists() })
    },
  })
}

/** Delete a device; the caller explains a refusal (409: people enrolled or punches kept). */
export function useDeleteDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (device: BiometricDevice) => devicesApi.remove(device),
    meta: { suppressErrorToast: true },
    onSuccess: async (_result, device) => {
      toast.success(`${device.name} (${device.code}) deleted`)
      queryClient.removeQueries({ queryKey: devicesKeys.detail(device.id) })
      await queryClient.invalidateQueries({ queryKey: devicesKeys.lists() })
    },
  })
}

/** Saves everyone on a device at once (with the device's rowVersion). */
export function useSaveEnrolments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ device, rows }: { device: BiometricDevice; rows: EnrolmentInput[] }) =>
      devicesApi.saveEnrolments(device, rows),
    meta: { suppressErrorToast: true },
    onSuccess: async (device) => {
      toast.success(
        `Enrolments saved: ${device.enrolledCount} ${device.enrolledCount === 1 ? 'person' : 'people'} on ${device.name}`,
      )
      queryClient.setQueryData(devicesKeys.detail(device.id), device)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: devicesKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: devicesKeys.enrolments(device.id) }),
      ])
    },
  })
}

/**
 * Imports a device's punch lines. They become machine punches, so the logs, time sheets and
 * the device's last sync all refetch.
 */
export function useImportDevicePunches() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceId, lines }: { deviceId: string; lines: DevicePunchLine[] }) =>
      devicesApi.importPunches(deviceId, lines),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      // `attendanceKeys.all` covers the logs, time sheets, overview and the devices.
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
