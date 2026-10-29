import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  EMPLOYEE_PROFILE_SEARCH_DEFAULTS,
  EmployeeProfilePage,
  employeeProfileSearchSchema,
} from '@/features/talent-management'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/talent-management/employees/$employeeId')({
  validateSearch: employeeProfileSearchSchema,
  search: { middlewares: [stripSearchParams(EMPLOYEE_PROFILE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Profile') }] }),
  component: EmployeeProfilePage,
})
