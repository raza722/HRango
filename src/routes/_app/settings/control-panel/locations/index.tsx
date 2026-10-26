import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  LocationListPage,
  locationResource,
  ORG_LIST_SEARCH_DEFAULTS,
  orgListSearchSchema,
} from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/locations/')({
  validateSearch: orgListSearchSchema,
  search: { middlewares: [stripSearchParams(ORG_LIST_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { page, pageSize, q } }) => ({ page, pageSize, q }),
  // Prefetch the page without blocking navigation.
  loader: ({ context: { queryClient }, deps: { page, pageSize, q } }) => {
    queryClient
      .query(locationResource.listQuery({ page, pageSize, search: q }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Locations') }] }),
  component: LocationListPage,
})
