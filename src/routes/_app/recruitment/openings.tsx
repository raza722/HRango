import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { OpeningsPage, openingsSearchSchema, PAGE_SEARCH_DEFAULTS } from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Job Openings: the list with its filters, the detail, New / Edit and the status steps. */
export const Route = createFileRoute('/_app/recruitment/openings')({
  validateSearch: openingsSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Job Openings') }] }),
  component: OpeningsPage,
})
