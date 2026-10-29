import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  CandidatesPage,
  candidatesSearchSchema,
  PAGE_SEARCH_DEFAULTS,
} from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Candidates: the applicants with their filters, the detail and Add / Edit. */
export const Route = createFileRoute('/_app/recruitment/candidates')({
  validateSearch: candidatesSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Candidates') }] }),
  component: CandidatesPage,
})
