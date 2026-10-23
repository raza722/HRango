import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { inboxApi, inboxKeys, inboxSummaryQueryOptions } from '../api/inbox.api'
import type { InboxKind, InboxSummary } from '../types/inbox.types'

/** Latest messages and notifications for the top bar menus (polls every minute). */
export function useInboxSummary() {
  return useQuery(inboxSummaryQueryOptions())
}

/** Marks every item of one kind as read; the unread dot clears immediately. */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (kind: InboxKind) => inboxApi.markAllRead(kind),
    onMutate: async (kind) => {
      await queryClient.cancelQueries({ queryKey: inboxKeys.summary() })
      const previous = queryClient.getQueryData<InboxSummary>(inboxKeys.summary())
      if (previous) {
        queryClient.setQueryData<InboxSummary>(inboxKeys.summary(), {
          ...previous,
          [kind]: previous[kind].map((item) => ({ ...item, read: true })),
        })
      }
      return { previous }
    },
    onError: (_error, _kind, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(inboxKeys.summary(), onMutateResult.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: inboxKeys.summary() }),
  })
}
