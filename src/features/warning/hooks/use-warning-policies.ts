import { useQuery } from '@tanstack/react-query'

import type { PolicyListParams } from '../api/warning-policy.api'
import {
  warningPoliciesQueryOptions,
  warningPolicyQueryOptions,
} from '../api/warning-policy.queries'

/**
 * Fetches one page of warning policies.
 * While a new page loads, the previous page stays visible (`isPlaceholderData`).
 *
 * @param params - 1-based page number and page size, optional search and kind.
 */
export function useWarningPolicies(params: PolicyListParams) {
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
