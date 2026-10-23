import { useQuery } from '@tanstack/react-query'

import type { PageParams } from '@/types/api'

import {
  warningPoliciesQueryOptions,
  warningPolicyQueryOptions,
} from '../api/warning-policy.queries'

/**
 * Fetches one page of warning policies.
 * While a new page loads, the previous page stays visible (`isPlaceholderData`).
 *
 * @param params - 1-based page number and page size.
 */
export function useWarningPolicies(params: PageParams) {
  return useQuery(warningPoliciesQueryOptions(params))
}

/**
 * Fetches a single policy. Pass `undefined` to stay idle (e.g. when not editing).
 *
 * @param id - Policy id, or `undefined` to disable the query.
 */
export function useWarningPolicy(id: string | undefined) {
  return useQuery({
    ...warningPolicyQueryOptions(id ?? ''),
    enabled: id !== undefined,
  })
}
