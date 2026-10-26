import { useState } from 'react'
import { Download, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'

import { EMPLOYEE_STATUS_OPTIONS as STATUS_OPTIONS, MONTH_NAMES as MONTHS } from '../../constants'
import { useOrgLookup } from '../../hooks/use-attendance-settings'
import type { OverviewSearch } from '../../routing'
import type { EmployeeStatusFilter } from '../../types/attendance.types'
import { FilterSelect } from '../shared/filter-select'

export interface OverviewFilterValues {
  status: EmployeeStatusFilter
  departmentId: string | undefined
  month: string
}

/**
 * Employee Status, Department, Month and Year, applied together with Search
 * as in the design, and Export (the API's CSV of the month). The API has no
 * employee filter on the overview: the search box above finds a person.
 */
export function OverviewFilters({
  search,
  month,
  onApply,
  onExport,
}: {
  search: OverviewSearch
  /** The month shown now, `yyyy-MM`. */
  month: string
  onApply: (values: OverviewFilterValues) => void
  onExport: () => Promise<void>
}) {
  const departments = useOrgLookup('departments')
  const canExport = useCan('attendance.overview.export')
  const [exporting, setExporting] = useState(false)
  const [values, setValues] = useState<OverviewFilterValues>({
    status: search.status,
    departmentId: search.departmentId,
    month,
  })
  const [year = '', monthNumber = ''] = values.month.split('-')
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => String(thisYear - 3 + index))

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
            set({ status: next })
          }}
        />
        <FilterSelect
          label="Department"
          tone="inter"
          allLabel="All departments"
          options={(departments.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          value={values.departmentId}
          onChange={(departmentId) => {
            set({ departmentId })
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
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="submit"
            className="h-10 w-full bg-[#2F6FED] px-10 text-base font-medium text-white hover:bg-[#2F6FED]/90 @md:w-auto"
          >
            <Search /> Search
          </Button>
          {canExport && (
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => {
                setExporting(true)
                void onExport().finally(() => {
                  setExporting(false)
                })
              }}
              className="h-10 w-full @md:w-auto"
            >
              <Download /> Export
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
