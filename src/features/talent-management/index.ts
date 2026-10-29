// Public API of the Talent Management feature. Import from '@/features/talent-management'.
export { employeeKeys, employeesApi } from './api/employees.api'
export { TalentManagementLayout } from './components/layout/talent-layout'
export { EmployeeRecordPage } from './components/list/employee-record-page'
export { EmployeeProfilePage } from './components/profile/employee-profile-page'
export { EMPLOYEE_STATUS_META, TM_CODES } from './constants'
export {
  EMPLOYEE_LIST_SEARCH_DEFAULTS,
  EMPLOYEE_PROFILE_SEARCH_DEFAULTS,
  type EmployeeListSearch,
  employeeListSearchSchema,
  type EmployeeProfileSearch,
  employeeProfileSearchSchema,
} from './routing'
export * from './types/employees.types'
