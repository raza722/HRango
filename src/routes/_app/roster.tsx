import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  ROSTER_SEARCH_DEFAULTS,
  rosterGroupsQueryOptions,
  RosterPage,
  rosterSearchSchema,
} from '@/features/roster'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/roster')({
  validateSearch: rosterSearchSchema,
  search: { middlewares: [stripSearchParams(ROSTER_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { page, pageSize, q } }) => ({ page, pageSize, q }),
  // Prefetch the list without blocking the page.
  loader: ({ context: { queryClient }, deps: { page, pageSize, q } }) => {
    queryClient
      .query(rosterGroupsQueryOptions({ page, pageSize, search: q }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Roster') }] }),
  component: RosterPage,
})
