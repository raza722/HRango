import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { FLOW_SEARCH_DEFAULTS, flowSearchSchema, RequestFlowsPage } from '@/features/requests'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/requests/settings/flows')({
  validateSearch: flowSearchSchema,
  search: { middlewares: [stripSearchParams(FLOW_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Request Flows') }] }),
  component: RequestFlowsPage,
})
