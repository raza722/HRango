import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type AssignmentFilters,
  type DelegationFilters,
  type PageParams,
  requestSettingsApi,
  requestSettingsKeys,
  type RestrictionFilters,
  settingsListQueryOptions,
} from '../api/request-settings.api'
import type {
  FlowAssignmentInput,
  FlowNode,
  FlowRequestType,
  RequestDelegationInput,
  RequestRestrictionInput,
} from '../types/request-settings.types'

// --- queries ------------------------------------------------------------------------------------

export const useRequestSettingsLookups = () =>
  useQuery({
    queryKey: requestSettingsKeys.lookups(),
    queryFn: ({ signal }) => requestSettingsApi.lookups(signal),
    staleTime: 60_000,
  })

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

export const useRequestFlow = (requestType: FlowRequestType) =>
  useQuery({
    queryKey: requestSettingsKeys.detail('flow', requestType),
    queryFn: ({ signal }) => requestSettingsApi.flow(requestType, signal),
  })

export const useFlowAssignments = (params: PageParams & AssignmentFilters) =>
  useQuery(settingsListQueryOptions('flow-assignments', params, requestSettingsApi.assignments))

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
  })
}

const count = (value: number, word: string) => `${String(value)} ${word}${value === 1 ? '' : 's'}`

export const useCreateRestriction = () =>
  useSettingsMutation(
    (input: RequestRestrictionInput) => requestSettingsApi.createRestriction(input),
    () => 'Request restriction created',
  )

export const useDeleteRestrictions = () =>
  useSettingsMutation(
    (ids: string[]) => requestSettingsApi.deleteRestrictions(ids),
    (_ids, result) => `${count(result.deleted, 'restriction')} deleted`,
  )

export const useCreateDelegation = () =>
  useSettingsMutation(
    (input: RequestDelegationInput) => requestSettingsApi.createDelegation(input),
    () => 'Delegation created',
  )

export const useSetDelegationsActive = () =>
  useSettingsMutation(
    ({ ids, active }: { ids: string[]; active: boolean }) =>
      requestSettingsApi.setDelegationsActive(ids, active),
    ({ active }, result) =>
      `${count(result.changed, 'delegation')} ${active ? 'made active' : 'made in active'}`,
  )

export const useSaveRequestFlow = () =>
  useSettingsMutation(
    ({ requestType, nodes }: { requestType: FlowRequestType; nodes: FlowNode[] }) =>
      requestSettingsApi.saveFlow(requestType, nodes),
    () => 'Request flow saved',
  )

export const useSaveFlowAssignments = () =>
  useSettingsMutation(
    (input: FlowAssignmentInput) => requestSettingsApi.saveAssignments(input),
    (_input, result) => `Authority set for ${count(result.changed, 'employee')}`,
  )
