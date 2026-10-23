import { createFileRoute } from '@tanstack/react-router'

import { BenefitFilesPage, benefitsSearchSchema } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/files')({
  validateSearch: benefitsSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Benefit Files') }] }),
  component: BenefitFilesPage,
})
