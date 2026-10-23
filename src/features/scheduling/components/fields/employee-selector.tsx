import { useId, useState } from 'react'
import { X } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { branchResource, locationResource, useOrgList } from '@/features/settings'
import { cn } from '@/lib/utils'

import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS } from '../../constants'
import { useEmployeeSearch, useSchedulingLookups } from '../../hooks/use-scheduling'
import {
  type EmployeeFilters,
  EMPLOYMENT_TYPES,
  GENDERS,
  type PickableEmployee,
} from '../../types/scheduling.types'

const ALL = '__all__'

export type SelectorFilter =
  | 'employee'
  | 'location'
  | 'designation'
  | 'department'
  | 'grade'
  | 'employmentType'
  | 'group'
  | 'branch'
  | 'gender'

const ALL_FILTERS: readonly SelectorFilter[] = [
  'employee',
  'location',
  'designation',
  'department',
  'grade',
  'employmentType',
  'group',
  'branch',
  'gender',
]

interface EmployeeSelectorProps {
  /** Which filters the full variant shows (all by default), in this order of the grid. */
  filters?: readonly SelectorFilter[]
  value: readonly string[]
  onChange: (ids: string[]) => void
  error?: string | undefined
  /** `compact` hides the filter grid (Create Scheduling step 2). */
  variant?: 'full' | 'compact'
  /** The dialog's family: filter labels Inter Medium 16 #000, or Poppins Regular 12 #303030. */
  appearance?: 'inter' | 'poppins'
  className?: string
}

/**
 * Figma draws the people lists in Poppins in every dialog: headings Poppins Medium 18 #202020,
 * names Poppins Medium 11 #202020, code and designation Poppins Regular 9 #707070. Create
 * Scheduling step 2 lists them as a table instead: Inter Regular 16 #101828.
 */
const headingClass = 'font-sans text-lg font-medium text-[#202020] dark:text-heading'

/**
 * Filters: label Inter Medium 16 #000 over Inter Regular 14 #475569, or (Create New Rest Day)
 * Poppins Regular 12 #303030 over Poppins Regular 14 #A4A4A4.
 */
const FILTER_TYPE = {
  inter: {
    label: 'font-inter font-medium text-heading sm:text-base',
    control: 'font-inter text-field-value',
    empty: 'text-field-value',
  },
  poppins: {
    label: 'font-sans text-xs text-title',
    control: 'font-sans',
    /** "Select …" (nothing picked) reads as a placeholder. */
    empty: 'text-[#A4A4A4] dark:text-label',
  },
} as const

function FilterField({
  label,
  placeholder,
  options,
  value,
  onChange,
  appearance,
}: {
  appearance: 'inter' | 'poppins'
  label: string
  placeholder: string
  options: readonly { value: string; label: string }[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className={FILTER_TYPE[appearance].label}>
        {label}
      </Label>
      <Select
        value={value ?? ALL}
        onValueChange={(picked) => {
          onChange(picked === ALL ? undefined : picked)
        }}
      >
        <SelectTrigger
          id={id}
          className={cn(
            'w-full',
            FILTER_TYPE[appearance].control,
            value === undefined && FILTER_TYPE[appearance].empty,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const PERSON_TYPE = {
  /** The Poppins lists (Select Employees, Selected Employees). */
  list: {
    root: 'font-sans',
    name: 'text-[0.6875rem] font-medium text-[#202020] dark:text-heading',
    code: 'text-[0.5625rem] font-normal text-grey',
    designation: 'text-[0.5625rem] text-grey',
  },
  /** Create Scheduling step 2 ("Employees Name" table): Inter Regular 16 #101828. */
  table: {
    root: 'font-inter',
    name: 'text-base text-[#101828] dark:text-heading',
    code: 'text-xs text-muted-foreground',
    designation: 'text-base text-[#101828] dark:text-heading',
  },
} as const

function PersonLine({ person, table = false }: { person: PickableEmployee; table?: boolean }) {
  const type = PERSON_TYPE[table ? 'table' : 'list']
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', type.root)}>
      <EmployeeAvatar name={person.name} className="size-7" />
      <span className="min-w-0">
        <span className={cn('block truncate', type.name)}>
          {person.name} <span className={type.code}>({person.code})</span>
        </span>
        <span className={cn('block truncate', type.designation)}>{person.designation}</span>
      </span>
    </span>
  )
}

/**
 * "Select Employees" from the designs: filters (Employee, Location,
 * Designation, Department, Grade, Employment Type, Group, Branch, Gender),
 * "All Employees" with checkboxes and "All", and "Selected Employees" chips.
 */
export function EmployeeSelector({
  value,
  onChange,
  error,
  variant = 'full',
  appearance = 'inter',
  filters: shownFilters = ALL_FILTERS,
  className,
}: EmployeeSelectorProps) {
  const show = (filter: SelectorFilter) => shownFilters.includes(filter)
  const errorId = useId()
  const allId = useId()
  const [filters, setFilters] = useState<EmployeeFilters & { search?: string }>({})
  const lookups = useSchedulingLookups()
  const locations = useOrgList(locationResource, { page: 1, pageSize: 100 })
  const branches = useOrgList(branchResource, { page: 1, pageSize: 100 })
  const results = useEmployeeSearch({ ...filters, status: 'active' })
  const selected = new Set(value)
  const people = results.data ?? []
  const everyone = new Map((lookups.data?.employees ?? []).map((person) => [person.id, person]))
  const allShown = people.length > 0 && people.every((person) => selected.has(person.id))

  const set = (patch: Partial<EmployeeFilters & { search?: string }>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onChange([...next])
  }
  const options = (values: readonly string[] | undefined) =>
    (values ?? []).map((item) => ({ value: item, label: item }))

  return (
    <div className={cn('grid gap-6', className)}>
      {variant === 'full' && (
        <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2 @3xl:grid-cols-3">
          {show('employee') && (
            <FilterField
              appearance={appearance}
              label="Employee"
              placeholder="Select Employee"
              options={(lookups.data?.employees ?? []).map((person) => ({
                value: person.id,
                label: `${person.name} (${person.code})`,
              }))}
              value={filters.employeeId}
              onChange={(employeeId) => {
                set({ employeeId })
              }}
            />
          )}
          {show('location') && (
            <FilterField
              appearance={appearance}
              label="Location"
              placeholder="Select Location"
              options={(locations.data?.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={filters.locationId}
              onChange={(locationId) => {
                set({ locationId })
              }}
            />
          )}
          {show('designation') && (
            <FilterField
              appearance={appearance}
              label="Designation"
              placeholder="Select Designation"
              options={options(lookups.data?.designations)}
              value={filters.designation}
              onChange={(designation) => {
                set({ designation })
              }}
            />
          )}
          {show('department') && (
            <FilterField
              appearance={appearance}
              label="Department"
              placeholder="Select Department"
              options={options(lookups.data?.departments)}
              value={filters.department}
              onChange={(department) => {
                set({ department })
              }}
            />
          )}
          {show('grade') && (
            <FilterField
              appearance={appearance}
              label="Grade"
              placeholder="Select Grade"
              options={options(lookups.data?.grades)}
              value={filters.grade}
              onChange={(grade) => {
                set({ grade })
              }}
            />
          )}
          {show('employmentType') && (
            <FilterField
              appearance={appearance}
              label="Employment Type"
              placeholder="Select Employment"
              options={EMPLOYMENT_TYPES.map((type) => ({
                value: type,
                label: EMPLOYMENT_TYPE_LABELS[type],
              }))}
              value={filters.employmentType}
              onChange={(employmentType) => {
                set({ employmentType: EMPLOYMENT_TYPES.find((type) => type === employmentType) })
              }}
            />
          )}
          {show('group') && (
            <FilterField
              appearance={appearance}
              label="Group"
              placeholder="Select Group"
              options={options(lookups.data?.groups)}
              value={filters.group}
              onChange={(group) => {
                set({ group })
              }}
            />
          )}
          {show('branch') && (
            <FilterField
              appearance={appearance}
              label="Branch"
              placeholder="Select Branch"
              options={(branches.data?.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={filters.branchId}
              onChange={(branchId) => {
                set({ branchId })
              }}
            />
          )}
          {show('gender') && (
            <FilterField
              appearance={appearance}
              label="Gender"
              placeholder="Gender"
              options={GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] }))}
              value={filters.gender}
              onChange={(gender) => {
                set({ gender: GENDERS.find((item) => item === gender) })
              }}
            />
          )}
        </div>
      )}

      <div className="grid gap-6 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby={`${allId}-title`} className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 id={`${allId}-title`} className={headingClass}>
              All Employees
            </h4>
            <label className="flex items-center gap-2 font-sans text-lg text-grey">
              <Checkbox
                aria-label="Select all shown employees"
                checked={allShown}
                disabled={people.length === 0}
                onCheckedChange={(checked) => {
                  const next = new Set(selected)
                  people.forEach((person) => {
                    if (checked === true) next.add(person.id)
                    else next.delete(person.id)
                  })
                  onChange([...next])
                }}
              />
              All
            </label>
          </div>
          {variant === 'compact' && (
            <input
              type="search"
              aria-label="Search employees"
              placeholder="Search name, id or designation"
              value={filters.search ?? ''}
              onChange={(event) => {
                set({ search: event.target.value })
              }}
              className="h-10 rounded-md border border-input bg-card px-3 text-base text-field-foreground outline-none placeholder:text-label focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:text-sm"
            />
          )}
          <ul
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'scrollbar-thin max-h-72 overflow-y-auto rounded-md border',
              error && 'border-destructive',
            )}
          >
            {results.isPending ? (
              <li className="grid gap-2 p-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </li>
            ) : people.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No employees match these filters.
              </li>
            ) : (
              people.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-muted">
                    <PersonLine person={person} table={variant === 'compact'} />
                    <Checkbox
                      aria-label={`Select ${person.name}`}
                      checked={selected.has(person.id)}
                      onCheckedChange={(checked) => {
                        toggle(person.id, checked === true)
                      }}
                    />
                  </label>
                </li>
              ))
            )}
          </ul>
        </section>

        <section aria-label="Selected employees" className="grid content-start gap-3">
          <h4 className={headingClass}>
            Selected Employees{' '}
            <span className="text-sm font-normal text-muted-foreground">({value.length})</span>
          </h4>
          {value.length === 0 ? (
            <p className="rounded-md bg-success/10 px-3 py-3 text-sm text-field-foreground">
              No Record Found. Tick people in the list to add them.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 @md:grid-cols-2 @4xl:grid-cols-3">
              {value.map((id) => {
                const person = everyone.get(id)
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2"
                  >
                    {person ? (
                      <PersonLine person={person} />
                    ) : (
                      <span className="text-sm">{id}</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${person?.name ?? id}`}
                      onClick={() => {
                        toggle(id, false)
                      }}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white outline-none hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <X className="size-3.5" strokeWidth={2.5} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      {error && (
        <p id={errorId} role="alert" className="-mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
