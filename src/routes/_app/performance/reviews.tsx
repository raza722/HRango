import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { REVIEWS_SEARCH_DEFAULTS, ReviewsPage, reviewsSearchSchema } from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → Reviews: the self and manager reviews of the signed-in person. */
export const Route = createFileRoute('/_app/performance/reviews')({
  validateSearch: reviewsSearchSchema,
  search: { middlewares: [stripSearchParams(REVIEWS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Reviews') }] }),
  component: ReviewsPage,
})
