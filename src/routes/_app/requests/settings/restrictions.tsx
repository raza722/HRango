import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { RestrictionsPage } from '@/features/requests'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/requests/settings/restrictions')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Request Restriction') }] }),
  component: RestrictionsPage,
})
