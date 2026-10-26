import { useInfiniteQuery, useMutation } from '@tanstack/react-query'

import { warningHistoryQueryOptions } from '../api/warning-history.api'
import type { WarningHistoryEntry } from '../types/warning-history.types'

/**
 * The Warning module's change log, newest first, a page at a time.
 *
 * @param enabled - Fetch only while the History dialog is open.
 * @param policyId - Only this policy's changes.
 */
export function useWarningHistory(enabled = true, policyId?: string) {
  return useInfiniteQuery({ ...warningHistoryQueryOptions(policyId), enabled })
}

const NOT_SUPPORTED = 'The history is an audit log and cannot be deleted.'

/**
 * Legacy (kept for the barrel): The API keeps the audit log; there is no delete. Kept so the barrel's names stay
 * stable; the mutation always fails with an explanation and nothing calls it.
 */
export function useDeleteHistoryEntry() {
  return useMutation({
    mutationFn: (_entry: WarningHistoryEntry) => Promise.reject(new Error(NOT_SUPPORTED)),
  })
}

/** Legacy (kept for the barrel): See {@link useDeleteHistoryEntry}: "Delete All" is not built. */
export function useClearHistory() {
  return useMutation({ mutationFn: () => Promise.reject(new Error(NOT_SUPPORTED)) })
}
