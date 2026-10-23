import { useState } from 'react'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { EMPLOYEE_STATUS_OPTIONS as STATUS_OPTIONS, MONTH_NAMES as MONTHS } from '../../constants'
import { useAttendanceLookups } from '../../hooks/use-attendance'
import type { OverviewSearch } from '../../routing'
import type { EmployeeStatusFilter } from '../../types/attendance.types'
import { FilterSelect } from '../shared/filter-select'

export interface OverviewFilterValues {
  status: EmployeeStatusFilter
  employeeId: string | undefined
  department: string | undefined
  month: string
}

/**
 * Employee Status, Employee Name, Department, Month and Year, applied
 * together with Search as in the design.
 */
export function OverviewFilters({
  search,
  month,
  onApply,
}: {
  search: OverviewSearch
  /** The month shown now, `yyyy-MM`. */
  month: string
  onApply: (values: OverviewFilterValues) => void
}) {
  const lookups = useAttendanceLookups()
  const [values, setValues] = useState<OverviewFilterValues>({
    status: search.status,
    employeeId: search.employeeId,
    department: search.department,
    month,
  })
  const [year = '', monthNumber = ''] = values.month.split('-')
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => String(thisYear - 3 + index))

  const employees = (lookups.data?.employees ?? []).filter(
    (employee) => values.status === 'all' || employee.status === values.status,
  )
  const set = (patch: Partial<OverviewFilterValues>) => {
    setValues((current) => ({ ...current, ...patch }))
  }

  return (
    <form
      aria-label="Filters"
      onSubmit={(event) => {
        event.preventDefault()
        onApply(values)
      }}
      className="@container rounded-xl bg-card px-4 py-5 font-inter shadow-xs sm:px-9 sm:py-6"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
        <FilterSelect
          label="Employee Status"
          tone="inter"
          options={STATUS_OPTIONS}
          value={values.status}
          onChange={(status) => {
            const next = STATUS_OPTIONS.find((option) => option.value === status)?.value ?? 'all'
            set({ status: next, employeeId: undefined })
          }}
        />
        <FilterSelect
          label="Employee Name"
          tone="inter"
          allLabel="All employees"
          options={employees.map((employee) => ({
            value: employee.id,
            label: `${employee.code} | ${employee.name}`,
          }))}
          value={values.employeeId}
          onChange={(employeeId) => {
            set({ employeeId })
          }}
        />
        <FilterSelect
          label="Department"
          tone="inter"
          allLabel="All departments"
          options={(lookups.data?.departments ?? []).map((name) => ({ value: name, label: name }))}
          value={values.department}
          onChange={(department) => {
            set({ department })
          }}
        />
        <FilterSelect
          label="Month"
          tone="inter"
          options={MONTHS.map((name, index) => ({
            value: String(index + 1).padStart(2, '0'),
            label: name,
          }))}
          value={monthNumber}
          onChange={(picked) => {
            if (picked) set({ month: `${year}-${picked}` })
          }}
        />
        <FilterSelect
          label="Year"
          tone="inter"
          options={years.map((value) => ({ value, label: value }))}
          value={year}
          onChange={(picked) => {
            if (picked) set({ month: `${picked}-${monthNumber}` })
          }}
        />
        <div className="flex items-end">
          <Button
            type="submit"
            className="h-10 w-full bg-[#2F6FED] px-10 text-base font-medium text-white hover:bg-[#2F6FED]/90 @md:w-auto"
          >
            <Search /> Search
          </Button>
        </div>
      </div>
    </form>
  )
}
