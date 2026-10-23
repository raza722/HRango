import { createFileRoute } from '@tanstack/react-router'

import { benefitsSearchSchema, PlanYearsPage } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/plan-years/')({
  validateSearch: benefitsSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Benefit Plan Years') }] }),
  component: PlanYearsPage,
})
