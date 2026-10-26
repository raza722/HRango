import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import { lookupsApi } from '../../../api/lookups.api'
import { standardKeys } from '../../standard.api'
import type { LoanAdvanceLookups, LoanTypeOption } from './loan-advances.types'

/**
 * The loan types `employeeId` (default: the signed-in person) may ask for, with their terms
 * and `eligible` (`GET /requests/options/loan-types`, held with `requests.loan.create`).
 */
export async function fetchLoanTypeOptions(
  employeeId: string | null,
  signal?: AbortSignal,
): Promise<LoanTypeOption[]> {
  const { data } = await apiClient.get<ApiItem<LoanTypeOption[]>>('/requests/options/loan-types', {
    params: employeeId ? { employeeId } : {},
    signal,
  })
  return data.data
}

/** One person's loan types (for a request filed on their behalf). */
export function useLoanTypeOptions(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: [...standardKeys.kind('loan-advances'), 'type-options', employeeId ?? ''],
    queryFn: ({ signal }) => fetchLoanTypeOptions(employeeId ?? null, signal),
    enabled: Boolean(employeeId),
  })
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

/**
 * The Create form's and filters' look-ups: the signed-in person's loan types and the
 * categories (the request forms' own option routes, so staff without the Loans settings
 * see them), and the locations and branches of the filters.
 */
export async function loadLoanAdvancesLookups(signal?: AbortSignal): Promise<LoanAdvanceLookups> {
  const [types, categories, locations, branches] = await Promise.all([
    fetchLoanTypeOptions(null, signal).catch((): LoanTypeOption[] => []),
    apiClient
      .get<ApiItem<{ id: string; name: string; description: string | null }[]>>(
        '/requests/options/loan-categories',
        { signal },
      )
      .then(({ data }) => data.data)
      .catch(() => []),
    lookupsApi.org('locations', undefined, signal).catch(() => []),
    lookupsApi.org('branches', undefined, signal).catch(() => []),
  ])
  return {
    types: [...types].sort(byName),
    categories: [...categories].sort(byName).map(({ id, name }) => ({ id, name })),
    locations,
    branches,
  }
}
