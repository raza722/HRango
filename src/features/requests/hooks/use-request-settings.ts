import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { employeeOptionsQuery, orgOptionsQuery } from '../api/lookups.api'
import {
  type AuthorityFilters,
  type DelegationFilters,
  type FlowFilters,
  type PageParams,
  requestSettingsApi,
  requestSettingsKeys,
  type RestrictionFilters,
  settingsListQueryOptions,
} from '../api/request-settings.api'
import type {
  RequestAuthorityInput,
  RequestDelegation,
  RequestDelegationInput,
  RequestFlowInput,
  RequestRestrictionInput,
} from '../types/request-settings.types'

// --- look-ups -----------------------------------------------------------------------------------

/** People a settings screen may pick (`GET /employees/lookup?permission=<the screen's code>`). */
export const useSettingsEmployees = (permission: string) =>
  useQuery(employeeOptionsQuery(permission))

export const useBranchOptions = () => useQuery(orgOptionsQuery('branches'))

/** Roles for Role nodes; only asked for when the user may read roles. */
export const useRoleOptions = (enabled: boolean) =>
  useQuery({
    queryKey: [...requestSettingsKeys.all, 'roles'],
    queryFn: ({ signal }) => requestSettingsApi.roles(signal),
    enabled,
    staleTime: 5 * 60_000,
  })
export const useDepartmentOptions = () => useQuery(orgOptionsQuery('departments'))

// --- queries ------------------------------------------------------------------------------------

export const useRestrictions = (params: PageParams & RestrictionFilters) =>
  useQuery(settingsListQueryOptions('restrictions', params, requestSettingsApi.restrictions))

export const useRestriction = (id: string | null) =>
  useQuery({
    queryKey: requestSettingsKeys.detail('restriction', id ?? ''),
    queryFn: ({ signal }) => requestSettingsApi.restriction(id ?? '', signal),
    enabled: id !== null,
  })

export const useDelegations = (params: PageParams & DelegationFilters) =>
  useQuery(settingsListQueryOptions('delegations', params, requestSettingsApi.delegations))

export const useDelegation = (id: string | null) =>
  useQuery({
    queryKey: requestSettingsKeys.detail('delegation', id ?? ''),
    queryFn: ({ signal }) => requestSettingsApi.delegation(id ?? '', signal),
    enabled: id !== null,
  })

export const useRequestFlows = (params: PageParams & FlowFilters) =>
  useQuery(settingsListQueryOptions('flows', params, requestSettingsApi.flows))

export const useRequestFlow = (id: string | null) =>
  useQuery({
    queryKey: requestSettingsKeys.detail('flow', id ?? ''),
    queryFn: ({ signal }) => requestSettingsApi.flow(id ?? '', signal),
    enabled: id !== null,
  })

export const useAuthorities = (params: PageParams & AuthorityFilters) =>
  useQuery(settingsListQueryOptions('authorities', params, requestSettingsApi.authorities))

// --- mutations ----------------------------------------------------------------------------------

/**
 * A settings change. Delegations and flows decide who approves, so every
 * Requests query refetches.
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
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
    onError: async () => {
      // A loop may have changed some rows before it stopped.
      await queryClient.invalidateQueries({ queryKey: requestSettingsKeys.all })
    },
  })
}

const count = (value: number, word: string) => `${String(value)} ${word}${value === 1 ? '' : 's'}`

export const useCreateRestriction = () =>
  useSettingsMutation(
    (input: RequestRestrictionInput) => requestSettingsApi.createRestriction(input),
    () => 'Request restriction created',
  )

/** Saves an edited restriction (`PUT` with the rowVersion last read). */
export const useUpdateRestriction = () =>
  useSettingsMutation(
    ({ id, input }: { id: string; input: RequestRestrictionInput }) =>
      requestSettingsApi.updateRestriction(id, input),
    () => 'Request restriction saved',
  )

/** Deletes the rows one by one (the API deletes one restriction at a time). */
export const useDeleteRestrictions = () =>
  useSettingsMutation(
    async (rows: readonly { id: string; rowVersion: string }[]) => {
      for (const row of rows) await requestSettingsApi.deleteRestriction(row)
      return rows.length
    },
    (_rows, deleted) => `${count(deleted, 'restriction')} deleted`,
  )

export const useCreateDelegation = () =>
  useSettingsMutation(
    (input: RequestDelegationInput) => requestSettingsApi.createDelegation(input),
    () => 'Delegation created',
  )

/** Deletes the delegations one by one (`DELETE ?rowVersion` each). */
export const useDeleteDelegations = () =>
  useSettingsMutation(
    async (rows: readonly { id: string; rowVersion: string }[]) => {
      for (const row of rows) await requestSettingsApi.deleteDelegation(row)
      return rows.length
    },
    (_rows, deleted) => `${count(deleted, 'delegation')} deleted`,
  )

/** Disable / Enable, one delegation after another (`PATCH` each). */
export const useSetDelegationsActive = () =>
  useSettingsMutation(
    async ({ rows, active }: { rows: readonly RequestDelegation[]; active: boolean }) => {
      let changed = 0
      for (const row of rows) {
        if (row.isActive === active) continue
        await requestSettingsApi.patchDelegation(row.id, {
          isActive: active,
          description: row.description,
          rowVersion: row.rowVersion,
        })
        changed += 1
      }
      return changed
    },
    ({ active }, changed) =>
      `${count(changed, 'delegation')} ${active ? 'made active' : 'made inactive'}`,
  )

/** Creates a flow, or saves a new version of one (`id`). */
export const useSaveRequestFlow = () =>
  useSettingsMutation(
    ({ id, input }: { id: string | null; input: RequestFlowInput }) =>
      id ? requestSettingsApi.updateFlow(id, input) : requestSettingsApi.createFlow(input),
    () => 'Request flow saved',
  )

export const useDeleteRequestFlow = () =>
  useSettingsMutation(
    (row: { id: string; rowVersion: string }) => requestSettingsApi.deleteFlow(row),
    () => 'Request flow deleted',
  )

export const useSaveAuthority = () =>
  useSettingsMutation(
    ({ id, input }: { id: string | null; input: RequestAuthorityInput }) =>
      id
        ? requestSettingsApi.updateAuthority(id, input)
        : requestSettingsApi.createAuthority(input),
    ({ id }) => (id ? 'Authority saved' : 'Authority created'),
  )

export const useDeleteAuthority = () =>
  useSettingsMutation(
    (row: { id: string; rowVersion: string }) => requestSettingsApi.deleteAuthority(row),
    () => 'Authority deleted',
  )
