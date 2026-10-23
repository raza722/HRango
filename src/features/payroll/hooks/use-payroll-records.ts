import { locationResource, useOrgList } from '@/features/settings'

import type { SearchOption } from '../components/shared/search-select'
import { usePayrollLookups } from './use-payroll'

/** The lookups as drop-down options for the records pages (filters and forms). */
export function usePayrollOptions() {
  const lookups = usePayrollLookups()
  const locations = useOrgList(locationResource, { page: 1, pageSize: 100 })
  const data = lookups.data
  const people = data?.employees ?? []
  const toPerson = (person: (typeof people)[number]): SearchOption => ({
    value: person.id,
    label: person.name,
    hint: `${person.code} · ${person.designation}`,
  })
  const designations = [...new Set(people.map((person) => person.designation))].sort()
  return {
    isPending: lookups.isPending,
    lookups: data,
    employees: people.map(toPerson),
    activeEmployees: people.filter((person) => person.status === 'active').map(toPerson),
    employeeCodes: people.map((person) => ({
      value: person.code,
      label: person.code,
      hint: person.name,
    })),
    departments: (data?.departments ?? []).map((value) => ({ value, label: value })),
    designations: designations.map((value) => ({ value, label: value })),
    branches: (data?.branches ?? []).map((branch) => ({ value: branch.id, label: branch.name })),
    locations: (locations.data?.data ?? []).map((location) => ({
      value: location.id,
      label: location.name,
    })),
    payItems: (data?.payItems ?? []).map((item) => ({ value: item.id, label: item.name })),
    accountTypes: (data?.accountTypes ?? []).map((item) => ({ value: item.id, label: item.name })),
    timeSlots: data?.timeSlots ?? [],
  }
}
