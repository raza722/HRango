import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  BranchListPage,
  branchResource,
  locationFilteredSearchSchema,
  ORG_LIST_SEARCH_DEFAULTS,
} from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/branches/')({
  validateSearch: locationFilteredSearchSchema,
  search: { middlewares: [stripSearchParams(ORG_LIST_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { page, pageSize, q, locationId } }) => ({
    page,
    pageSize,
    q,
    locationId,
  }),
  // Prefetch the page without blocking navigation.
  loader: ({ context: { queryClient }, deps: { page, pageSize, q, locationId } }) => {
    queryClient
      .query(branchResource.listQuery({ page, pageSize, search: q, locationId }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Branches') }] }),
  component: BranchListPage,
})
