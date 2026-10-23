import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'

import { fieldControlClassName } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { branchResource, locationResource, useOrgList } from '@/features/settings'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { EMPLOYMENT_TYPE_LABELS, VIEW_LABELS } from '../constants'
import { useSchedulingLookups } from '../hooks/use-scheduling'
import type { SchedulingSearch } from '../routing'
import { EMPLOYMENT_TYPES, SCHEDULE_VIEWS, type ScheduleView } from '../types/scheduling.types'

const ALL = '__all__'

/** Figma filters: Inter Regular 14 #475569, the empty date boxes too. */
const filterControlClass = 'w-full text-field-value'

interface Option {
  value: string
  label: string
}

function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  options: readonly Option[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(picked) => {
        onChange(picked === ALL ? undefined : picked)
      }}
    >
      <SelectTrigger aria-label={label} className={filterControlClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "16 August, 2024" date button with a calendar, for Date From / Date To. */
export function DateFilter({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  minDate?: Date | undefined
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseDateValue(value) : undefined
  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={selected ? `${label}: ${format(selected, 'd MMMM, yyyy')}` : label}
            className={cn(
              fieldControlClassName,
              'justify-between pr-10 text-left text-field-value',
            )}
          >
            <span className="truncate">{selected ? format(selected, 'd MMMM, yyyy') : label}</span>
            <CalendarDays className="size-5 shrink-0 text-field-foreground/70" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={minDate ? [{ before: minDate }] : []}
            autoFocus
            onSelect={(date) => {
              onChange(date ? toDateValue(date) : undefined)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange(undefined)
          }}
          className="absolute top-1/2 right-9 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-label outline-none hover:text-field-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

interface SchedulingFiltersProps {
  search: SchedulingSearch
  rosterOptions: readonly Option[]
  onChange: (patch: Partial<SchedulingSearch>) => void
  onClear: () => void
}

/**
 * The filter row(s) under the toolbar. "My" has Status, period and dates as
 * drawn; "All" and "Subordinates" add Roster, Location, Branch, Department,
 * Employee, Employment Type and Group.
 */
export function SchedulingFilters({
  search,
  rosterOptions,
  onChange,
  onClear,
}: SchedulingFiltersProps) {
  const lookups = useSchedulingLookups()
  const locations = useOrgList(locationResource, { page: 1, pageSize: 100 })
  const branches = useOrgList(branchResource, { page: 1, pageSize: 100 })
  const many = search.scope !== 'my'
  const toOptions = (values: readonly string[] | undefined) =>
    (values ?? []).map((value) => ({ value, label: value }))

  return (
    <section aria-label="Filters" className="grid gap-3 border-t pt-4">
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4 @6xl:grid-cols-6">
        <FilterSelect
          label="Employment status"
          allLabel="All statuses"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'In Active' },
          ]}
          value={search.status === 'all' ? undefined : search.status}
          onChange={(status) => {
            onChange({ status: status === 'active' || status === 'inactive' ? status : 'all' })
          }}
        />
        <Select
          value={search.view}
          onValueChange={(view) => {
            onChange({ view: view as ScheduleView, from: undefined, to: undefined })
          }}
        >
          <SelectTrigger aria-label="Period" className={filterControlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_VIEWS.map((view) => (
              <SelectItem key={view} value={view}>
                {VIEW_LABELS[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {many && (
          <>
            <FilterSelect
              label="Time slot"
              allLabel="All time slots"
              options={rosterOptions}
              value={search.rosterGroupId}
              onChange={(rosterGroupId) => {
                onChange({ rosterGroupId })
              }}
            />
            <FilterSelect
              label="Group"
              allLabel="All groups"
              options={toOptions(lookups.data?.groups)}
              value={search.group}
              onChange={(group) => {
                onChange({ group })
              }}
            />
            <FilterSelect
              label="Location"
              allLabel="All locations"
              options={(locations.data?.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={search.locationId}
              onChange={(locationId) => {
                onChange({ locationId })
              }}
            />
            <FilterSelect
              label="Branch"
              allLabel="All branches"
              options={(branches.data?.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={search.branchId}
              onChange={(branchId) => {
                onChange({ branchId })
              }}
            />
            <FilterSelect
              label="Department"
              allLabel="All departments"
              options={toOptions(lookups.data?.departments)}
              value={search.department}
              onChange={(department) => {
                onChange({ department })
              }}
            />
            <FilterSelect
              label="Employee"
              allLabel="All employees"
              options={(lookups.data?.employees ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} (${item.code})`,
              }))}
              value={search.employeeId}
              onChange={(employeeId) => {
                onChange({ employeeId })
              }}
            />
            <FilterSelect
              label="Employment type"
              allLabel="All employment types"
              options={EMPLOYMENT_TYPES.map((type) => ({
                value: type,
                label: EMPLOYMENT_TYPE_LABELS[type],
              }))}
              value={search.employmentType}
              onChange={(employmentType) => {
                onChange({
                  employmentType: EMPLOYMENT_TYPES.find((type) => type === employmentType),
                })
              }}
            />
          </>
        )}
        <DateFilter
          label="Date From"
          value={search.from}
          onChange={(from) => {
            onChange({ from, to: from && search.to && search.to < from ? undefined : search.to })
          }}
        />
        <DateFilter
          label="Date To"
          value={search.to}
          minDate={search.from ? parseDateValue(search.from) : undefined}
          onChange={(to) => {
            onChange({ to })
          }}
        />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X /> Clear filters
        </Button>
      </div>
    </section>
  )
}
