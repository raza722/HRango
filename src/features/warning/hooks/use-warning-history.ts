import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  warningHistoryApi,
  warningHistoryKeys,
  warningHistoryQueryOptions,
} from '../api/warning-history.api'
import type { WarningHistoryEntry } from '../types/warning-history.types'

/**
 * The Warning module's change log, newest first.
 *
 * @param enabled - Fetch only while the History dialog is open.
 */
export function useWarningHistory(enabled = true) {
  return useQuery({ ...warningHistoryQueryOptions(), enabled })
}

/** Optimistically replaces the cached log, returning the previous one for rollback. */
async function replaceLog(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (entries: WarningHistoryEntry[]) => WarningHistoryEntry[],
) {
  await queryClient.cancelQueries({ queryKey: warningHistoryKeys.all })
  const previous = queryClient.getQueryData<WarningHistoryEntry[]>(warningHistoryKeys.all)
  if (previous) queryClient.setQueryData(warningHistoryKeys.all, update(previous))
  return { previous }
}

/** Deletes one log entry (optimistic). */
export function useDeleteHistoryEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: WarningHistoryEntry) => warningHistoryApi.remove(entry.id),
    meta: { errorMessage: 'Could not delete the history entry.' },
    onMutate: (entry) =>
      replaceLog(queryClient, (entries) => entries.filter((e) => e.id !== entry.id)),
    onError: (_error, _entry, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(warningHistoryKeys.all, onMutateResult.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all }),
  })
}

/** Clears the whole log ("Delete All", optimistic). */
export function useClearHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => warningHistoryApi.clear(),
    meta: { errorMessage: 'Could not clear the history.' },
    onMutate: () => replaceLog(queryClient, () => []),
    onError: (_error, _variables, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(warningHistoryKeys.all, onMutateResult.previous)
      }
    },
    onSuccess: () => {
      toast.success('History cleared')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all }),
  })
}
