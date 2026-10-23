import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type { WarningPenalty, WarningPenaltyInput } from '../types/warning-penalty.types'

const BASE_PATH = '/warning-penalties'

/** REST calls for penalty configurations. */
export const warningPenaltyApi = {
  async list(params: PageParams, signal?: AbortSignal): Promise<Paginated<WarningPenalty>> {
    const { data } = await apiClient.get<Paginated<WarningPenalty>>(BASE_PATH, { params, signal })
    return data
  },

  async get(id: string, signal?: AbortSignal): Promise<WarningPenalty> {
    const { data } = await apiClient.get<ApiItem<WarningPenalty>>(`${BASE_PATH}/${id}`, { signal })
    return data.data
  },

  async create(input: WarningPenaltyInput): Promise<WarningPenalty> {
    const { data } = await apiClient.post<ApiItem<WarningPenalty>>(BASE_PATH, input)
    return data.data
  },

  async update(id: string, input: WarningPenaltyInput): Promise<WarningPenalty> {
    const { data } = await apiClient.put<ApiItem<WarningPenalty>>(`${BASE_PATH}/${id}`, input)
    return data.data
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${id}`)
  },
}

/** Query-key factory for penalties (same shape as `warningPolicyKeys`). */
export const warningPenaltyKeys = {
  all: ['warning-penalties'] as const,
  lists: () => [...warningPenaltyKeys.all, 'list'] as const,
  list: (params: PageParams) => [...warningPenaltyKeys.lists(), params] as const,
  details: () => [...warningPenaltyKeys.all, 'detail'] as const,
  detail: (id: string) => [...warningPenaltyKeys.details(), id] as const,
}

export function warningPenaltiesQueryOptions(params: PageParams) {
  return queryOptions({
    queryKey: warningPenaltyKeys.list(params),
    queryFn: ({ signal }) => warningPenaltyApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function warningPenaltyQueryOptions(id: string) {
  return queryOptions({
    queryKey: warningPenaltyKeys.detail(id),
    queryFn: ({ signal }) => warningPenaltyApi.get(id, signal),
  })
}
