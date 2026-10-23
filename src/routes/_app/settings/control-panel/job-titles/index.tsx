import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  JobTitleListPage,
  jobTitleResource,
  ORG_LIST_SEARCH_DEFAULTS,
  orgListSearchSchema,
} from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/job-titles/')({
  validateSearch: orgListSearchSchema,
  search: { middlewares: [stripSearchParams(ORG_LIST_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { page, pageSize, q } }) => ({ page, pageSize, q }),
  // Prefetch the page without blocking navigation.
  loader: ({ context: { queryClient }, deps: { page, pageSize, q } }) => {
    queryClient
      .query(jobTitleResource.listQuery({ page, pageSize, search: q }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Job Titles') }] }),
  component: JobTitleListPage,
})
