import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  EMPLOYEE_LIST_SEARCH_DEFAULTS,
  employeeListSearchSchema,
  EmployeeRecordPage,
} from '@/features/talent-management'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/talent-management/employees/')({
  validateSearch: employeeListSearchSchema,
  search: { middlewares: [stripSearchParams(EMPLOYEE_LIST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Record') }] }),
  component: EmployeeRecordPage,
})
