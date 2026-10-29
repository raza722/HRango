import { type QueryKey, useQuery } from '@tanstack/react-query'

import type { HubBadge } from '@/components/layout'
import { canViewUnder } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

/** One row is enough to read how many records match (`meta.total`). */
export const COUNT_PAGE = { page: 1, pageSize: 1 } as const

/**
 * A landing-page card's live count: how many records match a list query, fetched only when the
 * user may view that screen. The key sits under the list's own module key, so whatever
 * refreshes the list (a closed settlement, an approved clearance) refreshes the count too.
 */
export function useHubCount({
  queryKey,
  fetch,
  permission,
  label,
}: {
  queryKey: QueryKey
  fetch: (signal: AbortSignal) => Promise<{ meta: { total: number } }>
  permission: string
  label: string
}): HubBadge {
  const user = useAuthStore((state) => state.user)
  const enabled = canViewUnder(user, permission)
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetch(signal),
    enabled,
    select: (page) => page.meta.total,
  })
  return { count: query.data, isLoading: enabled && query.isPending, label }
}
