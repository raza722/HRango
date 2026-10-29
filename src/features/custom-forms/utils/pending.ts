import type { UseQueryResult } from '@tanstack/react-query'

import type { PaginatedResult } from '@/components/layout'
import type { Paginated } from '@/types/api'

import type { Pending } from '../types/custom-forms.types'

type PendingPageQuery<T> = UseQueryResult<Pending<Paginated<T>>>

/** The backend answered that it has no such endpoint yet. */
export const isUnavailable = (query: { data?: Pending<unknown> | undefined }) =>
  query.data?.available === false

/** A pending page query in the shape `PaginatedTableCard` reads. */
export function pagedResult<T>(query: PendingPageQuery<T>): PaginatedResult<T> {
  return {
    data: query.data?.available ? query.data.data : undefined,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  }
}
