import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  BranchListPage,
  branchResource,
  companyFilteredSearchSchema,
  ORG_LIST_SEARCH_DEFAULTS,
} from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/branches/')({
  validateSearch: companyFilteredSearchSchema,
  search: { middlewares: [stripSearchParams(ORG_LIST_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { page, pageSize, q, companyId } }) => ({ page, pageSize, q, companyId }),
  // Prefetch the page without blocking navigation.
  loader: ({ context: { queryClient }, deps: { page, pageSize, q, companyId } }) => {
    queryClient
      .query(branchResource.listQuery({ page, pageSize, search: q, companyId }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Branches') }] }),
  component: BranchListPage,
})
