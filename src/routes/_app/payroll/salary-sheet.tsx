import { createFileRoute } from '@tanstack/react-router'

import { SalarySheetPage, salarySheetSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/salary-sheet')({
  validateSearch: salarySheetSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Salary Sheet') }] }),
  component: SalarySheetPage,
})
