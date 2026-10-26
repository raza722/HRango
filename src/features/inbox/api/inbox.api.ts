import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  InboxChanged,
  InboxItem,
  InboxSummary,
  NotificationListParams,
} from '../types/inbox.types'

async function patch(path: string): Promise<InboxChanged> {
  const { data } = await apiClient.patch<ApiItem<InboxChanged>>(path)
  return data.data
}

/** The signed-in user's notifications (`/api/inbox`, permission `inbox.notifications.view`). */
export const inboxApi = {
  async summary(signal?: AbortSignal): Promise<InboxSummary> {
    const { data } = await apiClient.get<ApiItem<InboxSummary>>('/inbox', { signal })
    return data.data
  },

  async list(params: NotificationListParams, signal?: AbortSignal): Promise<Paginated<InboxItem>> {
    const { data } = await apiClient.get<Paginated<InboxItem>>('/inbox/notifications', {
      params: params.unreadOnly ? params : { page: params.page, pageSize: params.pageSize },
      signal,
    })
    return data
  },

  markRead: (id: string) => patch(`/inbox/notifications/${id}/read`),
  markAllRead: () => patch('/inbox/notifications/read-all'),
  /** Removes one from the inbox (it stays in the database). */
  clear: (id: string) => patch(`/inbox/notifications/${id}/clear`),
  clearAll: () => patch('/inbox/notifications/clear-all'),
}

export const inboxKeys = {
  all: ['inbox'] as const,
  summary: () => [...inboxKeys.all, 'summary'] as const,
  list: (params: NotificationListParams) => [...inboxKeys.all, 'list', params] as const,
}

export function inboxSummaryQueryOptions() {
  return queryOptions({
    queryKey: inboxKeys.summary(),
    queryFn: ({ signal }) => inboxApi.summary(signal),
    // The top bar polls gently so the unread dot stays current.
    refetchInterval: 60_000,
  })
}

export function notificationsQueryOptions(params: NotificationListParams) {
  return queryOptions({
    queryKey: inboxKeys.list(params),
    queryFn: ({ signal }) => inboxApi.list(params, signal),
  })
}
