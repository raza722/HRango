import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  AreaListPage,
  areaResource,
  locationFilteredSearchSchema,
  ORG_LIST_SEARCH_DEFAULTS,
} from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/areas/')({
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
      .query(areaResource.listQuery({ page, pageSize, search: q, locationId }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Areas') }] }),
  component: AreaListPage,
})
