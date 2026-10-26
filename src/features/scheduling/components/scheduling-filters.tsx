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
import { EmployeeSearchSelect } from '@/features/payroll'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { EMPLOYEE_STATUS_LABELS, SCHEDULING_PERMISSIONS, VIEW_LABELS } from '../constants'
import { useOrgLookup, useRosterGroupOptions, useTimeSlotOptions } from '../hooks/use-scheduling'
import type { SchedulingSearch } from '../routing'
import {
  EMPLOYEE_STATUS_FILTERS,
  type OrgLookupKind,
  SCHEDULE_VIEWS,
  type ScheduleView,
} from '../types/scheduling.types'

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

/** An organisation filter (`GET /organisation/lookups/{kind}`), fetched once the panel opens. */
function LookupFilter({
  kind,
  label,
  allLabel,
  value,
  onChange,
}: {
  kind: OrgLookupKind
  label: string
  allLabel: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const lookup = useOrgLookup(kind)
  return (
    <FilterSelect
      label={label}
      allLabel={allLabel}
      options={(lookup.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
      value={value}
      onChange={onChange}
    />
  )
}

type FilterKey =
  | 'locationId'
  | 'branchId'
  | 'departmentId'
  | 'designationId'
  | 'gradeId'
  | 'employeeGroupId'
  | 'employmentTypeId'

const ORG_FILTERS: readonly {
  key: FilterKey
  kind: OrgLookupKind
  label: string
  allLabel: string
}[] = [
  { key: 'locationId', kind: 'locations', label: 'Location', allLabel: 'All locations' },
  { key: 'branchId', kind: 'branches', label: 'Branch', allLabel: 'All branches' },
  { key: 'departmentId', kind: 'departments', label: 'Department', allLabel: 'All departments' },
  {
    key: 'designationId',
    kind: 'designations',
    label: 'Designation',
    allLabel: 'All designations',
  },
  { key: 'gradeId', kind: 'grades', label: 'Grade', allLabel: 'All grades' },
  { key: 'employeeGroupId', kind: 'employee-groups', label: 'Group', allLabel: 'All groups' },
  {
    key: 'employmentTypeId',
    kind: 'employment-types',
    label: 'Employment type',
    allLabel: 'All employment types',
  },
]

interface SchedulingFiltersProps {
  search: SchedulingSearch
  onChange: (patch: Partial<SchedulingSearch>) => void
  onClear: () => void
}

/**
 * The filter row(s) under the toolbar, as `GET /scheduling/schedules` takes them. "My" has
 * Status, period and dates as drawn; "All" and "Subordinates" add Time Slot, Time Roster,
 * Location, Branch, Department, Designation, Grade, Group, Employment Type and Employee.
 */
export function SchedulingFilters({ search, onChange, onClear }: SchedulingFiltersProps) {
  const many = search.scope !== 'my'
  const slots = useTimeSlotOptions()
  const rosters = useRosterGroupOptions()

  return (
    <section aria-label="Filters" className="grid gap-3 border-t pt-4">
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4 @6xl:grid-cols-6">
        <FilterSelect
          label="Employment status"
          allLabel="All statuses"
          options={EMPLOYEE_STATUS_FILTERS.map((status) => ({
            value: status,
            label: EMPLOYEE_STATUS_LABELS[status],
          }))}
          value={search.status === 'all' ? undefined : search.status}
          onChange={(status) => {
            onChange({ status: EMPLOYEE_STATUS_FILTERS.find((item) => item === status) ?? 'all' })
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
              options={(slots.data ?? []).map((slot) => ({ value: slot.id, label: slot.name }))}
              value={search.timeSlotId}
              onChange={(timeSlotId) => {
                onChange({ timeSlotId })
              }}
            />
            <FilterSelect
              label="Time roster"
              allLabel="All time rosters"
              options={(rosters.data ?? []).map((group) => ({
                value: group.id,
                label: group.name,
              }))}
              value={search.rosterGroupId}
              onChange={(rosterGroupId) => {
                onChange({ rosterGroupId })
              }}
            />
            {ORG_FILTERS.map((filter) => (
              <LookupFilter
                key={filter.key}
                kind={filter.kind}
                label={filter.label}
                allLabel={filter.allLabel}
                value={search[filter.key]}
                onChange={(value) => {
                  onChange({ [filter.key]: value })
                }}
              />
            ))}
            {/* Searched on the server and paged ("Load more"), so anyone can be picked. */}
            <EmployeeSearchSelect
              aria-label="Employee"
              placeholder="All employees"
              clearable
              filters={{ permission: SCHEDULING_PERMISSIONS.view }}
              value={search.employeeId ?? null}
              onChange={(employeeId) => {
                onChange({ employeeId: employeeId ?? undefined })
              }}
              className={filterControlClass}
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
