import { useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { parseDateValue } from '@/lib/date'

import { EMPLOYEE_STATUS_OPTIONS } from '../../constants'
import { useAttendanceLookups } from '../../hooks/use-attendance'
import type { EmployeeStatusFilter, TimeSheetScope } from '../../types/attendance.types'
import { DateBox } from '../shared/date-box'
import { FilterSelect } from '../shared/filter-select'

/** Longest From → To range the time sheet shows at once. */
const MAX_DAYS = 93

export interface TimeSheetFilterValues {
  status: EmployeeStatusFilter
  employeeId: string | undefined
  from: string
  to: string
}

function rangeError(from: string, to: string): string | null {
  const start = parseDateValue(from)
  const end = parseDateValue(to)
  if (!start || !end) return 'Choose both dates'
  if (end < start) return 'To must be on or after From'
  if (differenceInCalendarDays(end, start) + 1 > MAX_DAYS) return `Choose at most ${MAX_DAYS} days`
  return null
}

/**
 * My: "My Time Sheet" with From, To and Search. All: Employee Status,
 * Employee Name, From, To and Search. Nothing applies until Search.
 */
export function TimeSheetFilters({
  scope,
  initial,
  onApply,
}: {
  scope: TimeSheetScope
  initial: TimeSheetFilterValues
  onApply: (values: TimeSheetFilterValues) => void
}) {
  const lookups = useAttendanceLookups()
  const [values, setValues] = useState(initial)
  const error = rangeError(values.from, values.to)
  const employees = (lookups.data?.employees ?? []).filter(
    (employee) => values.status === 'all' || employee.status === values.status,
  )
  const set = (patch: Partial<TimeSheetFilterValues>) => {
    setValues((current) => ({ ...current, ...patch }))
  }

  return (
    <form
      aria-label={scope === 'my' ? 'My Time Sheet' : 'Time sheet filters'}
      onSubmit={(event) => {
        event.preventDefault()
        if (!error) onApply(values)
      }}
      className="@container rounded-xl bg-card px-4 py-4 font-inter shadow-xs sm:px-5"
    >
      {scope === 'my' && <h2 className="mb-3 text-sm font-medium text-heading">My Time Sheet</h2>}
      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-3 @md:grid-cols-2 @4xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {scope === 'all' && (
          <>
            <FilterSelect
              label="Employee Status"
              showLabel
              tone="inter"
              options={EMPLOYEE_STATUS_OPTIONS}
              value={values.status}
              onChange={(status) => {
                set({
                  status:
                    EMPLOYEE_STATUS_OPTIONS.find((option) => option.value === status)?.value ??
                    'all',
                })
              }}
            />
            <FilterSelect
              label="Employee Name"
              showLabel
              tone="inter"
              options={employees.map((employee) => ({
                value: employee.id,
                label: `${employee.code} | ${employee.name}`,
              }))}
              value={values.employeeId}
              onChange={(employeeId) => {
                set({ employeeId })
              }}
            />
          </>
        )}
        <DateBox
          label="From"
          tone="inter"
          value={values.from}
          onChange={(from) => {
            set({ from })
          }}
        />
        <div className="grid gap-1">
          <DateBox
            label="To"
            tone="inter"
            value={values.to}
            minDate={parseDateValue(values.from)}
            onChange={(to) => {
              set({ to })
            }}
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-end self-stretch @md:col-span-2 @4xl:col-span-1">
          <Button
            type="submit"
            disabled={error !== null}
            className="mt-auto h-9 w-full bg-[#3B6FF5] px-6 text-base font-medium text-white hover:bg-[#3B6FF5]/90 @md:w-auto"
          >
            <Search /> Search
          </Button>
        </div>
      </div>
    </form>
  )
}
