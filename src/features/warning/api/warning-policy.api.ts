import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type { WarningPolicy, WarningPolicyInput } from '../types/warning-policy.types'

const BASE_PATH = '/warning-policies'

/** REST calls for warning policies. Hooks wrap these; components never call them directly. */
export const warningPolicyApi = {
  async list(params: PageParams, signal?: AbortSignal): Promise<Paginated<WarningPolicy>> {
    const { data } = await apiClient.get<Paginated<WarningPolicy>>(BASE_PATH, { params, signal })
    return data
  },

  async get(id: string, signal?: AbortSignal): Promise<WarningPolicy> {
    const { data } = await apiClient.get<ApiItem<WarningPolicy>>(`${BASE_PATH}/${id}`, { signal })
    return data.data
  },

  async create(input: WarningPolicyInput): Promise<WarningPolicy> {
    const { data } = await apiClient.post<ApiItem<WarningPolicy>>(BASE_PATH, input)
    return data.data
  },

  async update(id: string, input: WarningPolicyInput): Promise<WarningPolicy> {
    const { data } = await apiClient.put<ApiItem<WarningPolicy>>(`${BASE_PATH}/${id}`, input)
    return data.data
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${id}`)
  },
}
