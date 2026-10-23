import { createFileRoute } from '@tanstack/react-router'

import { NewPlanYearPage } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/plan-years/new')({
  head: () => ({ meta: [{ title: pageTitle('New Plan Year') }] }),
  component: NewPlanYearPage,
})
