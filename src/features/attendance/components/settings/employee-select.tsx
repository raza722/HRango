import { useState } from 'react'

import { useEmployeeLookup } from '../../hooks/use-attendance-settings'
import type { EmployeeOption } from '../../types/settings.types'
import { type MultiOption, MultiSelect } from './multi-select'

const employeeLabel = (employee: Pick<EmployeeOption, 'name' | 'code'>) =>
  `${employee.name} (${employee.code})`

/**
 * Employees picked from `/employees/lookup` (searched on the server as you type, a page at a
 * time with "Load more") with the permission of the screen, so the list holds whom the user
 * may set this up for. `known` names the people already chosen, who may not be among the
 * matches.
 */
export function EmployeeMultiSelect({
  permission,
  value,
  onChange,
  label = 'Employees',
  known,
  className,
}: {
  permission: string
  value: readonly string[]
  onChange: (value: string[]) => void
  label?: string
  known?: readonly { id: string; label: string }[]
  className?: string
}) {
  const [query, setQuery] = useState('')
  // The lookup debounces the typed text itself.
  const lookup = useEmployeeLookup(permission, query)
  // A choice keeps its name when a new search hides it: earlier pages are still cached.
  const nameOf = (id: string) => {
    const employee = lookup.find(id)
    return employee
      ? employeeLabel(employee)
      : (known?.find((item) => item.id === id)?.label ?? `Employee ${id}`)
  }
  const matches: MultiOption[] = lookup.rows.map((employee) => ({
    value: employee.id,
    label: employeeLabel(employee),
  }))
  const chosen = value
    .filter((id) => !matches.some((option) => option.value === id))
    .map((id) => ({ value: id, label: nameOf(id) }))

  return (
    <MultiSelect
      label={label}
      options={[...chosen, ...matches]}
      value={value}
      onChange={onChange}
      onQueryChange={setQuery}
      loading={lookup.isFetching}
      hasMore={lookup.hasMore}
      onLoadMore={lookup.loadMore}
      {...(className ? { className } : {})}
    />
  )
}
