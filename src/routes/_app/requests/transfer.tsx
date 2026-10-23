import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  REQUEST_SEARCH_DEFAULTS,
  requestSearchSchema,
  TransferRequestsPage,
} from '@/features/requests'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/requests/transfer')({
  validateSearch: requestSearchSchema,
  search: { middlewares: [stripSearchParams(REQUEST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Transfer Requests') }] }),
  component: TransferRequestsPage,
})
