import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  APPLICATIONS_SEARCH_DEFAULTS,
  ApplicationsPage,
  applicationsSearchSchema,
} from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Applications: the pipeline board or list, the detail and every stage action. */
export const Route = createFileRoute('/_app/recruitment/applications')({
  validateSearch: applicationsSearchSchema,
  search: { middlewares: [stripSearchParams(APPLICATIONS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Applications') }] }),
  component: ApplicationsPage,
})
