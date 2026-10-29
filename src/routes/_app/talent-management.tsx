import { createFileRoute } from '@tanstack/react-router'

import { TalentManagementLayout } from '@/features/talent-management'

/** Talent Management: the sub menu (Employees, Transfer, Salary Revision, Employee Accounts). */
export const Route = createFileRoute('/_app/talent-management')({
  component: TalentManagementLayout,
})
