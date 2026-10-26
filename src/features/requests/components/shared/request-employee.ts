import type { FilterField, SearchOption } from '@/features/payroll'
import { type EmployeeLookupFilters, useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'

import { type PersonOption, toPersonOption } from '../../api/lookups.api'

/*
 * The Requests screens' employee pickers read `GET /employees/lookup` page by page,
 * searched on the server (see `RequestEmployeeField`). These helpers give the same
 * filters to a picker, a Filters dialog field and the look-up of whom was picked.
 */

/** Whom a picker offers: the people the screen's permission code reaches. */
export const requestEmployeeFilters = (
  permission: string,
  includeInactive = false,
): EmployeeLookupFilters => (includeInactive ? { permission, includeInactive } : { permission })

/** A person already known by name (a request's own employee …), for the picker's `known`. */
export interface KnownPerson {
  id: string | null | undefined
  name: string | null | undefined
  code?: string | null | undefined
}

/** `known` options for people the lookup may not have read yet (none for an empty id). */
export function knownPeople(people: readonly (KnownPerson | null | undefined)[]): SearchOption[] {
  const options = new Map<string, SearchOption>()
  for (const person of people) {
    if (!person?.id || options.has(person.id)) continue
    options.set(person.id, {
      value: person.id,
      label: person.name ?? person.code ?? person.id,
      ...(person.code ? { hint: person.code } : {}),
    })
  }
  return [...options.values()]
}

/**
 * The Filters dialog's employee field over `GET /employees/lookup` (server search, paged),
 * former employees included (their requests stay on the lists).
 */
export function employeeFilterField(
  permission: string,
  {
    key = 'employeeId',
    label = 'Employee',
    placeholder = 'Select Employee',
  }: { key?: string; label?: string; placeholder?: string } = {},
): FilterField {
  return {
    kind: 'employee',
    key,
    label,
    placeholder,
    filters: requestEmployeeFilters(permission, true),
  }
}

/**
 * The person behind a picked id, from the pages the picker read with the same
 * `permission` (any search): what `people.find(id)` gave when the forms held everyone.
 * Undefined until a page holding them is read (e.g. a request's own employee before the
 * picker opens): fall back to what the request says.
 */
export function useRequestPerson(
  permission: string,
  id: string | null | undefined,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): PersonOption | undefined {
  // Reads nothing itself: it watches the picker's first page and searches every cached one.
  const lookup = useEmployeeLookupSearch(requestEmployeeFilters(permission, includeInactive), {
    enabled: false,
  })
  const row = lookup.find(id)
  return row ? toPersonOption(row) : undefined
}
