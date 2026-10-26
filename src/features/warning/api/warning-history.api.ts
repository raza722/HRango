import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Paginated } from '@/types/api'

import type { WarningHistoryEntry } from '../types/warning-history.types'

const BASE_PATH = '/warning/history'

/** Lines per page of the History dialog. */
export const HISTORY_PAGE_SIZE = 50

export interface HistoryParams {
  page: number
  pageSize: number
  policyId?: string | undefined
}

/**
 * Audit log of warning policies (and their penalties), newest first. The log cannot be deleted:
 * the API has no delete routes.
 */
export const warningHistoryApi = {
  async list(params: HistoryParams, signal?: AbortSignal): Promise<Paginated<WarningHistoryEntry>> {
    const { data } = await apiClient.get<Paginated<WarningHistoryEntry>>(BASE_PATH, {
      params: params.policyId ? params : { page: params.page, pageSize: params.pageSize },
      signal,
    })
    return data
  },
}

export const warningHistoryKeys = {
  all: ['warning-history'] as const,
  list: (policyId?: string) => [...warningHistoryKeys.all, policyId ?? 'all'] as const,
}

/** The log, loaded a page at a time ("Load more"). */
export function warningHistoryQueryOptions(policyId?: string) {
  return infiniteQueryOptions({
    queryKey: warningHistoryKeys.list(policyId),
    queryFn: ({ signal, pageParam }) =>
      warningHistoryApi.list({ page: pageParam, pageSize: HISTORY_PAGE_SIZE, policyId }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  })
}

/** The first page only (e.g. a policy's recent changes). */
export function warningHistoryPageQueryOptions(params: HistoryParams) {
  return queryOptions({
    queryKey: [...warningHistoryKeys.list(params.policyId), 'page', params],
    queryFn: ({ signal }) => warningHistoryApi.list(params, signal),
  })
}
