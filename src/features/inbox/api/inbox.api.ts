import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type { InboxKind, InboxSummary } from '../types/inbox.types'

export const inboxApi = {
  async summary(signal?: AbortSignal): Promise<InboxSummary> {
    const { data } = await apiClient.get<ApiItem<InboxSummary>>('/inbox', { signal })
    return data.data
  },

  async markAllRead(kind: InboxKind): Promise<void> {
    await apiClient.post(`/inbox/${kind}/read`)
  },
}

export const inboxKeys = {
  all: ['inbox'] as const,
  summary: () => [...inboxKeys.all, 'summary'] as const,
}

export function inboxSummaryQueryOptions() {
  return queryOptions({
    queryKey: inboxKeys.summary(),
    queryFn: ({ signal }) => inboxApi.summary(signal),
    // The top bar polls gently so the unread dot stays current.
    refetchInterval: 60_000,
  })
}
