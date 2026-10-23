import { createFileRoute } from '@tanstack/react-router'

import { benefitsSearchSchema, EnrollmentWindowsPage } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/enrollment-windows')({
  validateSearch: benefitsSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Enrollment Windows') }] }),
  component: EnrollmentWindowsPage,
})
