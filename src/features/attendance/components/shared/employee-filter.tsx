import { useId } from 'react'

import { EmployeeSearchSelect, type SearchOption } from '@/features/payroll'
import type { EmployeeLookupFilters, EmployeeLookupRow } from '@/hooks/use-employee-lookup'
import { cn } from '@/lib/utils'

/**
 * An "Employee" filter: one person or everyone (`undefined`), from `GET /employees/lookup`
 * searched on the server as you type and paged ("Load more"), so it works for any number of
 * people. The label sits above, as on the logs and the time sheet.
 */
export function EmployeeFilter({
  label,
  allLabel = 'All employees',
  value,
  onChange,
  filters,
  known,
  include,
  tone = 'poppins',
  className,
}: {
  label: string
  allLabel?: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  filters: EmployeeLookupFilters
  /** The chosen person's name when no page read so far has them. */
  known?: readonly SearchOption[] | undefined
  include?: ((row: EmployeeLookupRow) => boolean) | undefined
  /** `inter`: the older Inter frames (time sheet). */
  tone?: 'poppins' | 'inter'
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('grid min-w-0 gap-1.5', tone === 'inter' && 'font-inter', className)}>
      <label htmlFor={id} className="text-sm font-medium text-heading">
        {label}
      </label>
      <EmployeeSearchSelect
        id={id}
        value={value ?? null}
        onChange={(next) => {
          onChange(next ?? undefined)
        }}
        filters={filters}
        known={known}
        include={include}
        placeholder={allLabel}
        clearable
      />
    </div>
  )
}
