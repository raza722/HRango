import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { OffBoardingChecklistPage } from '@/features/offboarding'
import { PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/off-boarding/checklist')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Off Boarding Checklist') }] }),
  component: OffBoardingChecklistPage,
})
