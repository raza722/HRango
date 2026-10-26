import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { type PolicyListParams, warningPolicyApi } from './warning-policy.api'

/**
 * Query-key factory. Invalidate `lists()` after writes; `detail(id)` holds one record.
 * Keys are hierarchical, so `all` matches everything for this feature.
 */
export const warningPolicyKeys = {
  all: ['warning-policies'] as const,
  lists: () => [...warningPolicyKeys.all, 'list'] as const,
  list: (params: PolicyListParams) => [...warningPolicyKeys.lists(), params] as const,
  details: () => [...warningPolicyKeys.all, 'detail'] as const,
  detail: (id: string) => [...warningPolicyKeys.details(), id] as const,
}

/** One page of policies. Keeps the previous page on screen while the next loads. */
export function warningPoliciesQueryOptions(params: PolicyListParams) {
  return queryOptions({
    queryKey: warningPolicyKeys.list(params),
    queryFn: ({ signal }) => warningPolicyApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** A single policy, for the view page and for loading the edit forms. */
export function warningPolicyQueryOptions(id: string) {
  return queryOptions({
    queryKey: warningPolicyKeys.detail(id),
    queryFn: ({ signal }) => warningPolicyApi.get(id, signal),
  })
}

/** Every policy (up to 100), for the penalty form's policy picker. */
export function allWarningPoliciesQueryOptions() {
  return warningPoliciesQueryOptions({ page: 1, pageSize: 100 })
}
