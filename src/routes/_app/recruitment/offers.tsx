import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { OffersPage, offersSearchSchema, PAGE_SEARCH_DEFAULTS } from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Offers: the list with its status chips, New / Edit, Send, Response, Withdraw and Delete. */
export const Route = createFileRoute('/_app/recruitment/offers')({
  validateSearch: offersSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Offers') }] }),
  component: OffersPage,
})
