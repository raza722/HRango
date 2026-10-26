import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type { WarningPenaltyInput } from '../types/warning-penalty.types'
import type { AppliesTo, WarningPolicy, WarningPolicyInput } from '../types/warning-policy.types'

const BASE_PATH = '/warning/policies'

/** `WarningPolicyOut` as sent, before the alias fields are added. */
type WarningPolicyOut = Omit<WarningPolicy, 'policyName' | 'timeSpan'>

/** Adds the read-only `policyName` / `timeSpan` aliases older screens read. */
export function toWarningPolicy(policy: WarningPolicyOut): WarningPolicy {
  return { ...policy, policyName: policy.appliesTo, timeSpan: policy.period }
}

export interface PolicyListParams extends PageParams {
  q?: string | undefined
  appliesTo?: AppliesTo | undefined
}

/** REST calls for warning policies (`/api/warning/policies`). Hooks wrap these. */
export const warningPolicyApi = {
  async list(params: PolicyListParams, signal?: AbortSignal): Promise<Paginated<WarningPolicy>> {
    const { data } = await apiClient.get<Paginated<WarningPolicyOut>>(BASE_PATH, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
      ),
      signal,
    })
    return { ...data, data: data.data.map(toWarningPolicy) }
  },

  async get(id: string, signal?: AbortSignal): Promise<WarningPolicy> {
    const { data } = await apiClient.get<ApiItem<WarningPolicyOut>>(`${BASE_PATH}/${id}`, {
      signal,
    })
    return toWarningPolicy(data.data)
  },

  async create(input: WarningPolicyInput): Promise<WarningPolicy> {
    const { data } = await apiClient.post<ApiItem<WarningPolicyOut>>(BASE_PATH, input)
    return toWarningPolicy(data.data)
  },

  /** `input.rowVersion` must be the one last read. */
  async update(id: string, input: WarningPolicyInput): Promise<WarningPolicy> {
    const { data } = await apiClient.put<ApiItem<WarningPolicyOut>>(`${BASE_PATH}/${id}`, input)
    return toWarningPolicy(data.data)
  },

  /** Refused (409) while warnings were raised under the policy: make it inactive instead. */
  async remove(id: string, rowVersion?: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${id}`, {
      params: rowVersion ? { rowVersion } : undefined,
    })
  },

  /** Replaces the policy's penalty rules (`PUT /warning/policies/{id}/penalties`). */
  async savePenalties(id: string, input: WarningPenaltyInput): Promise<WarningPolicy> {
    const { data } = await apiClient.put<ApiItem<WarningPolicyOut>>(
      `${BASE_PATH}/${id}/penalties`,
      input,
    )
    return toWarningPolicy(data.data)
  },
}
