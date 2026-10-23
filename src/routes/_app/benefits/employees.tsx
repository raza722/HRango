import { createFileRoute } from '@tanstack/react-router'

import { BenefitEmployeesPage, benefitEmployeesSearchSchema } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/employees')({
  validateSearch: benefitEmployeesSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Benefit Employees') }] }),
  component: BenefitEmployeesPage,
})
