import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { schedulingKeys } from '@/features/scheduling'

import { attendanceKeys } from '../api/attendance.api'
import {
  attendanceLogsQueryOptions,
  configQueryOptions,
  logsApi,
  resourceListQueryOptions,
  restDaysQueryOptions,
  settingsApi,
  settingsKeys,
  settingsLookupsQueryOptions,
  type SettingsResourceName,
  type SettingsResources,
} from '../api/settings.api'
import type {
  AttendanceLogInput,
  AttendanceLogParams,
  AttendanceSettings,
  FileImportRow,
  ListParams,
} from '../types/settings.types'

export function useAttendanceSettings() {
  return useQuery(configQueryOptions())
}

export function useSettingsLookups() {
  return useQuery(settingsLookupsQueryOptions())
}

export function useSettingsList<N extends SettingsResourceName>(
  name: N,
  params: ListParams & { year?: string },
) {
  return useQuery(resourceListQueryOptions(name, params))
}

/** Every break type, with the name of an id ("lunch" → "Lunch Break"). */
export function useBreakTypes() {
  const { data } = useQuery(resourceListQueryOptions('breakTypes', { page: 1, pageSize: 100 }))
  const list = data?.data ?? []
  const nameOf = (id: string) => list.find((item) => item.id === id)?.name ?? id
  return { list, nameOf }
}

export function useRestDays(params: ListParams) {
  return useQuery(restDaysQueryOptions(params))
}

export function useRestDayBatch(id: string) {
  return useQuery({
    queryKey: settingsKeys.restDayBatch(id),
    queryFn: ({ signal }) => settingsApi.restDayBatch(id, signal),
  })
}

export function useAttendanceLogs(params: AttendanceLogParams) {
  return useQuery(attendanceLogsQueryOptions(params))
}

export function useMachines() {
  return useQuery({
    queryKey: settingsKeys.machines(),
    queryFn: ({ signal }) => logsApi.machines(signal),
  })
}

/**
 * A Settings or Logs change: attendance, schedules and geo fences depend on
 * these, so all of them refetch; the toast says what happened.
 */
function useSettingsMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: (variables: TVariables, result: TResult) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      toast.success(message(variables, result))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: schedulingKeys.all }),
        queryClient.invalidateQueries({ queryKey: schedulingKeys.geoFences() }),
      ])
    },
  })
}

export const useSaveSettings = () =>
  useSettingsMutation(
    (input: AttendanceSettings) => settingsApi.saveConfig(input),
    () => 'Settings saved',
  )

const NOUNS: Record<SettingsResourceName, string> = {
  breakTypes: 'Break type',
  ipRestrictions: 'IP restriction',
  geoFences: 'Geo fence',
  holidays: 'Holiday',
}

/** Create (no id) or update (id) a record of a Settings list. */
export function useSaveSetting<N extends SettingsResourceName>(name: N) {
  return useSettingsMutation(
    ({ id, input }: { id?: string | undefined; input: SettingsResources[N]['input'] }) =>
      id ? settingsApi.resource(name).update(id, input) : settingsApi.resource(name).create(input),
    ({ id }) => `${NOUNS[name]} ${id ? 'updated' : 'created'}`,
  )
}

export const useDeleteSetting = (name: SettingsResourceName) =>
  useSettingsMutation(
    (id: string) => settingsApi.resource(name).remove(id),
    () => `${NOUNS[name]} deleted`,
  )

export const useSetSettingActive = <N extends 'ipRestrictions' | 'geoFences'>(name: N) =>
  useSettingsMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      settingsApi.resource(name).setActive(id, active),
    ({ active }) => `${NOUNS[name]} ${active ? 'activated' : 'deactivated'}`,
  )

export const useDeleteRestDayBatch = () =>
  useSettingsMutation(
    (id: string) => settingsApi.deleteRestDayBatch(id),
    () => 'Rest days deleted',
  )

export const useDeleteRestDayRange = () =>
  useSettingsMutation(
    ({ from, to }: { from: string; to: string }) => settingsApi.deleteRestDayRange(from, to),
    (_variables, result) =>
      result.deleted === 0
        ? 'There were no rest days in that range'
        : `${result.deleted} rest day${result.deleted === 1 ? '' : 's'} deleted`,
  )

export const useSaveLog = () =>
  useSettingsMutation(
    ({ id, input }: { id?: string | undefined; input: AttendanceLogInput }) =>
      id ? logsApi.update(id, input) : logsApi.create(input),
    ({ id }) => (id ? 'Attendance log updated' : 'Attendance log created'),
  )

export const useDeleteLog = () =>
  useSettingsMutation(
    (id: string) => logsApi.remove(id),
    () => 'Attendance log deleted',
  )

export const useImportMachines = () =>
  useSettingsMutation(
    (machineIds: string[]) => logsApi.importMachines(machineIds),
    (_variables, result) =>
      `Imported ${result.imported} punch${result.imported === 1 ? '' : 'es'} from ${result.machines.length} machine${result.machines.length === 1 ? '' : 's'}`,
  )

export const useImportFile = () =>
  useSettingsMutation(
    (rows: FileImportRow[]) => logsApi.importFile(rows),
    (_variables, result) =>
      `Imported ${result.created} punch${result.created === 1 ? '' : 'es'}${result.skipped ? `, ${result.skipped} skipped` : ''}`,
  )
