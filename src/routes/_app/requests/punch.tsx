import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  PunchRequestsPage,
  REQUEST_SEARCH_DEFAULTS,
  requestSearchSchema,
} from '@/features/requests'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/requests/punch')({
  validateSearch: requestSearchSchema,
  search: { middlewares: [stripSearchParams(REQUEST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Punch Requests') }] }),
  component: PunchRequestsPage,
})
