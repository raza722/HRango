import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { PageParams, Paginated } from '@/types/api'

import type {
  LeaveTypeOption,
  WarningPenalty,
  WarningPenaltyInput,
} from '../types/warning-penalty.types'
import type { WarningPolicy } from '../types/warning-policy.types'
import { warningPolicyApi } from './warning-policy.api'
import { warningPolicyQueryOptions } from './warning-policy.queries'

const BASE_PATH = '/warning/penalties'

export interface PenaltyListParams extends PageParams {
  policyId?: string | undefined
}

/**
 * Penalties. The list is every penalty rule with its policy (`GET /warning/penalties`); rules are
 * saved per policy, all at once (`PUT /warning/policies/{id}/penalties`).
 */
export const warningPenaltyApi = {
  async list(params: PenaltyListParams, signal?: AbortSignal): Promise<Paginated<WarningPenalty>> {
    const { data } = await apiClient.get<Paginated<WarningPenalty>>(BASE_PATH, {
      params: params.policyId ? params : { page: params.page, pageSize: params.pageSize },
      signal,
    })
    return data
  },

  /** The policy whose penalties are edited (its rules and rowVersion). */
  get(policyId: string, signal?: AbortSignal): Promise<WarningPolicy> {
    return warningPolicyApi.get(policyId, signal)
  },

  save(policyId: string, input: WarningPenaltyInput): Promise<WarningPolicy> {
    return warningPolicyApi.savePenalties(policyId, input)
  },

  /** Active leave types for the deduction (`GET /leaves/types`, needs leaves.settings.types.view). */
  async leaveTypes(signal?: AbortSignal): Promise<LeaveTypeOption[]> {
    const { data } = await apiClient.get<Paginated<LeaveTypeOption>>('/leaves/types', {
      params: { isActive: true, page: 1, pageSize: 100 },
      signal,
    })
    return data.data.map(({ id, title }) => ({ id, title }))
  },
}

/** Query-key factory for penalties (same shape as `warningPolicyKeys`). */
export const warningPenaltyKeys = {
  all: ['warning-penalties'] as const,
  lists: () => [...warningPenaltyKeys.all, 'list'] as const,
  list: (params: PenaltyListParams) => [...warningPenaltyKeys.lists(), params] as const,
  details: () => [...warningPenaltyKeys.all, 'detail'] as const,
  detail: (id: string) => [...warningPenaltyKeys.details(), id] as const,
  leaveTypes: () => [...warningPenaltyKeys.all, 'leave-types'] as const,
}

export function warningPenaltiesQueryOptions(params: PenaltyListParams) {
  return queryOptions({
    queryKey: warningPenaltyKeys.list(params),
    queryFn: ({ signal }) => warningPenaltyApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** The policy whose penalties are being edited (shares the policy's detail cache). */
export function warningPenaltyQueryOptions(policyId: string) {
  return warningPolicyQueryOptions(policyId)
}

export function leaveTypeOptionsQueryOptions() {
  return queryOptions({
    queryKey: warningPenaltyKeys.leaveTypes(),
    queryFn: ({ signal }) => warningPenaltyApi.leaveTypes(signal),
    staleTime: 5 * 60_000,
  })
}
