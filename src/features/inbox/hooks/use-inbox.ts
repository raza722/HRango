import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useCan } from '@/lib/permissions'

import { inboxApi, inboxKeys, inboxSummaryQueryOptions } from '../api/inbox.api'
import type { InboxKind, InboxSummary } from '../types/inbox.types'

/** Holds `inbox.notifications.view` (everyone in mock mode). */
export function useCanSeeInbox() {
  return useCan('inbox.notifications.view')
}

/** Unread count and the latest notifications for the bell (polls every minute). */
export function useInboxSummary(options: { enabled?: boolean } = {}) {
  return useQuery({ ...inboxSummaryQueryOptions(), enabled: options.enabled ?? true })
}

/** Applies a change to the cached summary at once; returns the previous one to roll back. */
async function patchSummary(
  queryClient: QueryClient,
  change: (summary: InboxSummary) => InboxSummary,
) {
  await queryClient.cancelQueries({ queryKey: inboxKeys.summary() })
  const previous = queryClient.getQueryData<InboxSummary>(inboxKeys.summary())
  if (previous) queryClient.setQueryData<InboxSummary>(inboxKeys.summary(), change(previous))
  return { previous }
}

function useInboxMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  change: (summary: InboxSummary, variables: TVariables) => InboxSummary,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: (variables: TVariables) =>
      patchSummary(queryClient, (summary) => change(summary, variables)),
    onError: (_error, _variables, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(inboxKeys.summary(), onMutateResult.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  })
}

/**
 * Marks every notification read; the unread dot clears immediately. The `kind` argument is
 * kept for the menu: messages have no API, so marking them is a no-op.
 */
export function useMarkAllRead() {
  return useInboxMutation(
    async (kind: InboxKind = 'notifications') => {
      if (kind === 'notifications') await inboxApi.markAllRead()
    },
    (summary, kind = 'notifications') =>
      kind === 'notifications'
        ? { unread: 0, latest: summary.latest.map((item) => ({ ...item, read: true })) }
        : summary,
  )
}

/** Marks one notification read (clicking it in the menu). */
export function useMarkRead() {
  return useInboxMutation(
    (id: string) => inboxApi.markRead(id),
    (summary, id) => {
      const target = summary.latest.find((item) => item.id === id)
      if (!target || target.read) return summary
      return {
        unread: Math.max(0, summary.unread - 1),
        latest: summary.latest.map((item) => (item.id === id ? { ...item, read: true } : item)),
      }
    },
  )
}

/** Removes one notification from the inbox. */
export function useClearNotification() {
  return useInboxMutation(
    (id: string) => inboxApi.clear(id),
    (summary, id) => {
      const target = summary.latest.find((item) => item.id === id)
      return {
        unread: target && !target.read ? Math.max(0, summary.unread - 1) : summary.unread,
        latest: summary.latest.filter((item) => item.id !== id),
      }
    },
  )
}
