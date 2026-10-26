import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { schedulingKeys } from '@/features/scheduling'
import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'

import { attendanceKeys } from '../api/attendance.api'
import {
  basicSettingsQueryOptions,
  type ListFilters,
  lookupsApi,
  resourceListQueryOptions,
  resourceQueryOptions,
  settingsApi,
  settingsKeys,
  type SettingsResourceName,
  type SettingsResources,
} from '../api/settings.api'
import type {
  BasicSettings,
  EmployeeOption,
  GeoFenceSetting,
  IpRestriction,
  ListParams,
  OrgLookupKind,
  RestDayRangeDelete,
  SchedulingSettings,
} from '../types/settings.types'
import { fenceInput, restrictionInput } from '../utils/criteria'

export function useBasicSettings() {
  return useQuery(basicSettingsQueryOptions())
}

/** Scheduling switches: the API has no endpoint yet, so this fails outside the mock API. */
export function useSchedulingSettings() {
  return useQuery({
    queryKey: settingsKeys.scheduling(),
    queryFn: ({ signal }) => settingsApi.scheduling(signal),
    retry: false,
  })
}

export function useSettingsList<N extends SettingsResourceName>(
  name: N,
  params: ListParams & ListFilters,
  enabled = true,
) {
  return useQuery({ ...resourceListQueryOptions(name, params), enabled })
}

/** One record with everything the list leaves out (targets, rules, employees). */
export function useSettingsRecord<N extends SettingsResourceName>(name: N, id: string | null) {
  return useQuery({ ...resourceQueryOptions(name, id ?? ''), enabled: id !== null })
}

/** Every break type, with the name of an id ("12" → "Lunch Break"). */
export function useBreakTypes() {
  const { data } = useQuery(resourceListQueryOptions('breakTypes', { page: 1, pageSize: 100 }))
  const list = data?.data ?? []
  const nameOf = (id: string) => list.find((item) => item.id === id)?.name ?? id
  return { list, nameOf }
}

// --- pickers --------------------------------------------------------------------------------

/**
 * Employees the screen's permission reaches (`GET /employees/lookup`), searched on the server
 * (`search` is debounced here) and paged: `rows` so far, `hasMore` / `loadMore` for the next
 * page, `find(id)` for anyone any page under this permission has read.
 */
export function useEmployeeLookup(permission: string, search = '', enabled = true) {
  return useEmployeeLookupSearch<EmployeeOption>({ permission }, { search, enabled })
}

export function useOrgLookup(kind: OrgLookupKind, enabled = true) {
  return useQuery({
    queryKey: settingsKeys.org(kind),
    queryFn: ({ signal }) => lookupsApi.org(kind, signal),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCountries(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.countries(),
    queryFn: ({ signal }) => lookupsApi.countries(signal),
    staleTime: 30 * 60_000,
    enabled,
  })
}

export function useStates(countryId: string | null) {
  return useQuery({
    queryKey: settingsKeys.states(countryId ?? ''),
    queryFn: ({ signal }) => lookupsApi.states(countryId ?? '', signal),
    staleTime: 30 * 60_000,
    enabled: countryId !== null,
  })
}

export function useCities(stateId: string | null) {
  return useQuery({
    queryKey: settingsKeys.cities(stateId ?? ''),
    queryFn: ({ signal }) => lookupsApi.cities(stateId ?? '', signal),
    staleTime: 30 * 60_000,
    enabled: stateId !== null,
  })
}

/**
 * A Settings change: attendance, schedules and geo fences depend on
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
      ])
    },
  })
}

export const useSaveBasicSettings = () =>
  useSettingsMutation(
    (input: BasicSettings) => settingsApi.saveBasic(input),
    () => 'Settings saved',
  )

export const useSaveSchedulingSettings = () =>
  useSettingsMutation(
    (input: SchedulingSettings) => settingsApi.saveScheduling(input),
    () => 'Settings saved',
  )

const NOUNS: Record<SettingsResourceName, string> = {
  breakTypes: 'Break type',
  ipRestrictions: 'IP restriction',
  geoFences: 'Geo fence',
  holidays: 'Holiday',
  restDays: 'Rest day rule',
}

/** Create (no id) or update (id; the input carries the rowVersion) a record of a Settings list. */
export function useSaveSetting<N extends SettingsResourceName>(name: N) {
  return useSettingsMutation(
    ({ id, input }: { id?: string | undefined; input: SettingsResources[N]['input'] }) =>
      id ? settingsApi.resource(name).update(id, input) : settingsApi.resource(name).create(input),
    ({ id }) => `${NOUNS[name]} ${id ? 'updated' : 'created'}`,
  )
}

export const useDeleteSetting = (name: SettingsResourceName) =>
  useSettingsMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string | null }) =>
      settingsApi.resource(name).remove(id, rowVersion),
    () => `${NOUNS[name]} deleted`,
  )

/**
 * The list's Activate / Deactivate. The API has no status call: read the whole record (the
 * list leaves its targets out) and save it back with `isActive` flipped.
 */
export const useSetSettingActive = (name: 'ipRestrictions' | 'geoFences') =>
  useSettingsMutation(
    async ({ id, active }: { id: string; active: boolean }) => {
      if (name === 'ipRestrictions') {
        const api = settingsApi.resource('ipRestrictions')
        const record: IpRestriction = await api.get(id)
        return api.update(id, { ...restrictionInput(record), isActive: active })
      }
      const api = settingsApi.resource('geoFences')
      const record: GeoFenceSetting = await api.get(id)
      return api.update(id, { ...fenceInput(record), isActive: active })
    },
    ({ active }) => `${NOUNS[name]} ${active ? 'activated' : 'deactivated'}`,
  )

export const useDeleteRestDayRange = () =>
  useSettingsMutation(
    (input: RestDayRangeDelete) => settingsApi.deleteRestDayRange(input),
    (_variables, result) =>
      result.deletedRestDays === 0
        ? 'There were no rest days in that range'
        : `${result.deletedRestDays} rest day${result.deletedRestDays === 1 ? '' : 's'} deleted`,
  )
