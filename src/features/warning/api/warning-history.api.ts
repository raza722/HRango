import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type { WarningHistoryEntry } from '../types/warning-history.types'

const BASE_PATH = '/warning-history'

/** Audit log of changes to warning policies and penalties. */
export const warningHistoryApi = {
  /** Newest first. */
  async list(signal?: AbortSignal): Promise<WarningHistoryEntry[]> {
    const { data } = await apiClient.get<ApiItem<WarningHistoryEntry[]>>(BASE_PATH, { signal })
    return data.data
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${id}`)
  },

  async clear(): Promise<void> {
    await apiClient.delete(BASE_PATH)
  },
}

export const warningHistoryKeys = {
  all: ['warning-history'] as const,
}

export function warningHistoryQueryOptions() {
  return queryOptions({
    queryKey: warningHistoryKeys.all,
    queryFn: ({ signal }) => warningHistoryApi.list(signal),
  })
}
