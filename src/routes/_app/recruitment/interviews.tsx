import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  InterviewsPage,
  interviewsSearchSchema,
  PAGE_SEARCH_DEFAULTS,
} from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Interviews: grouped by day, with scheduling, completion, cancelling and evaluations. */
export const Route = createFileRoute('/_app/recruitment/interviews')({
  validateSearch: interviewsSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Interviews') }] }),
  component: InterviewsPage,
})
