import { z } from 'zod'

import { EMPLOYEE_PAGE_SIZE, EMPLOYEE_PAGE_SIZES } from './constants'
import { EMPLOYEE_STATUSES, PROFILE_TABS } from './types/employees.types'

const optionalText = z.string().trim().min(1).optional().catch(undefined)

/** Defaults left out of the list URL. */
export const EMPLOYEE_LIST_SEARCH_DEFAULTS = { page: 1, pageSize: EMPLOYEE_PAGE_SIZE } as const

/**
 * `/talent-management/employees?q=&status=&branchId=&departmentId=&designationId=
 * &includeInactive=true&page=&pageSize=&dialog=add&edit=<id>`: the search, the filter panel,
 * the pager, and the Add / Edit dialog. Bad values fall back.
 */
export const employeeListSearchSchema = z.object({
  q: optionalText,
  status: z.enum(EMPLOYEE_STATUSES).optional().catch(undefined),
  branchId: optionalText,
  departmentId: optionalText,
  designationId: optionalText,
  includeInactive: z.boolean().optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .number()
    .int()
    .refine((size) => (EMPLOYEE_PAGE_SIZES as readonly number[]).includes(size))
    .default(EMPLOYEE_PAGE_SIZE)
    .catch(EMPLOYEE_PAGE_SIZE),
  dialog: z.enum(['add']).optional().catch(undefined),
  edit: optionalText,
})
export type EmployeeListSearch = z.infer<typeof employeeListSearchSchema>

/** Where the list was (search, filters, page) without its Add / Edit dialog. */
export type EmployeeListView = Omit<EmployeeListSearch, 'dialog' | 'edit'>

const LIST_VIEW_KEY = 'hrms-tm-employee-list-view'

const listView = (search: EmployeeListSearch): EmployeeListView => ({
  q: search.q,
  status: search.status,
  branchId: search.branchId,
  departmentId: search.departmentId,
  designationId: search.designationId,
  includeInactive: search.includeInactive,
  page: search.page,
  pageSize: search.pageSize,
})

/**
 * The Employee Record keeps its place for this browser tab, so "Employee Record" on a profile
 * returns to the same search, filters and page, as the browser's Back button does.
 */
export function saveEmployeeListView(search: EmployeeListSearch) {
  try {
    sessionStorage.setItem(LIST_VIEW_KEY, JSON.stringify(listView(search)))
  } catch {
    // Storage switched off: the link opens the list from the start.
  }
}

/** The list's last place in this tab (checked again, so a stale or edited value falls back). */
export function savedEmployeeListView(): EmployeeListView | undefined {
  try {
    const raw = sessionStorage.getItem(LIST_VIEW_KEY)
    return raw ? listView(employeeListSearchSchema.parse(JSON.parse(raw))) : undefined
  } catch {
    return undefined
  }
}

/** Defaults left out of the profile URL. */
export const EMPLOYEE_PROFILE_SEARCH_DEFAULTS = { tab: 'personal' } as const

/** `/talent-management/employees/$employeeId?tab=work`. */
export const employeeProfileSearchSchema = z.object({
  tab: z.enum(PROFILE_TABS).default('personal').catch('personal'),
})
export type EmployeeProfileSearch = z.infer<typeof employeeProfileSearchSchema>
