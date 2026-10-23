import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  REQUEST_SEARCH_DEFAULTS,
  requestSearchSchema,
  ShiftRequestsPage,
} from '@/features/requests'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/requests/shift')({
  validateSearch: requestSearchSchema,
  search: { middlewares: [stripSearchParams(REQUEST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Shift Requests') }] }),
  component: ShiftRequestsPage,
})
