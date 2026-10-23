import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { EndOfEmploymentPage } from '@/features/offboarding'
import { PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/end-of-employment/completed')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Completed · End of Employment') }] }),
  component: () => <EndOfEmploymentPage scope="completed" />,
})
