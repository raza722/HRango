import { createFileRoute } from '@tanstack/react-router'

import { benefitsSearchSchema, PlansPage } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/plans/')({
  validateSearch: benefitsSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Benefit Plans') }] }),
  component: PlansPage,
})
