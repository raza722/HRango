import type { EmployeeLookupFilters } from '@/hooks/use-employee-lookup'

import { lookupApi } from '../api/payroll.api'
import type { SearchOption } from '../components/shared/search-select'
import type { EmployeeLookup, LookupItem } from '../types/payroll.types'
import { useOrganisationLookup, useResourceLookup, useTimeSlotLookup } from './use-payroll'

/** A person's second line in a picker: code and designation (or job title). */
export const personHint = (
  person: Pick<EmployeeLookup, 'code' | 'designationName' | 'jobTitleName'>,
) => [person.code, person.designationName ?? person.jobTitleName].filter(Boolean).join(' · ')

const toOption = (item: LookupItem): SearchOption => ({ value: item.id, label: item.name })

/**
 * Drop-down options for the records pages (filters and forms), from the API's pickers:
 * `/organisation/lookups/*` and the payroll settings lists. People are not preloaded: the
 * employee pickers (`EmployeeSearchSelect`, filter kind `employee`) search
 * `GET /employees/lookup?permission=` on the server and page through it, so they work for any
 * number of people; `employeeFilters` / `activeEmployeeFilters` say whom they hold.
 */
export function usePayrollOptions(permission = 'payroll.payrolls.view') {
  const branches = useOrganisationLookup('branches')
  const departments = useOrganisationLookup('departments')
  const designations = useOrganisationLookup('designations')
  const locations = useOrganisationLookup('locations')
  const payItems = useResourceLookup('payItems')
  const accountTypes = useResourceLookup('accountTypes')
  const timeSlots = useTimeSlotLookup()
  /** Everyone the screen's code reaches, former staff too (filters, existing records). */
  const employeeFilters: EmployeeLookupFilters = { permission, includeInactive: true }
  /** Current staff only (new records). */
  const activeEmployeeFilters: EmployeeLookupFilters = { permission }
  return {
    employeeFilters,
    activeEmployeeFilters,
    /** A real employee code for an import template's sample row (read when it is asked for). */
    sampleEmployeeCode: async () => {
      const page = await lookupApi
        .employees({ ...employeeFilters, permission, pageSize: 1 })
        .catch(() => null)
      return page?.data[0]?.code ?? 'EMP-0001'
    },
    branches: (branches.data ?? []).map(toOption),
    departments: (departments.data ?? []).map(toOption),
    designations: (designations.data ?? []).map(toOption),
    locations: (locations.data ?? []).map(toOption),
    payItems: (payItems.data?.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    accountTypes: (accountTypes.data?.data ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
    timeSlots: timeSlots.data ?? [],
  }
}
