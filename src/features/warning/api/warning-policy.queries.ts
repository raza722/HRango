import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import type { PageParams } from '@/types/api'

import { warningPolicyApi } from './warning-policy.api'

/**
 * Query-key factory. Invalidate `lists()` after writes; `detail(id)` holds one record.
 * Keys are hierarchical, so `all` matches everything for this feature.
 */
export const warningPolicyKeys = {
  all: ['warning-policies'] as const,
  lists: () => [...warningPolicyKeys.all, 'list'] as const,
  list: (params: PageParams) => [...warningPolicyKeys.lists(), params] as const,
  details: () => [...warningPolicyKeys.all, 'detail'] as const,
  detail: (id: string) => [...warningPolicyKeys.details(), id] as const,
}

/** One page of policies. Keeps the previous page on screen while the next loads. */
export function warningPoliciesQueryOptions(params: PageParams) {
  return queryOptions({
    queryKey: warningPolicyKeys.list(params),
    queryFn: ({ signal }) => warningPolicyApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** A single policy, for the view page and for loading the edit form. */
export function warningPolicyQueryOptions(id: string) {
  return queryOptions({
    queryKey: warningPolicyKeys.detail(id),
    queryFn: ({ signal }) => warningPolicyApi.get(id, signal),
  })
}
