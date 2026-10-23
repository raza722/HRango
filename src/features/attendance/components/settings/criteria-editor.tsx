import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { useSettingsLookups } from '../../hooks/use-attendance-settings'
import type { AudienceCriteria, SettingsLookups } from '../../types/settings.types'
import { newCriteria } from '../../utils/criteria'
import { navyButtonClass, switchOnClass } from '../../utils/settings-styles'
import { DateBox } from '../shared/date-box'
import { type MultiOption, MultiSelect } from './multi-select'

type ListField = Exclude<
  keyof AudienceCriteria,
  'id' | 'target' | 'joiningFrom' | 'joiningTo' | 'employeeIds'
>

const FIELDS: [ListField, string, (lookups: SettingsLookups) => MultiOption[]][] = [
  ['departments', 'Departments', (l) => l.departments.map((value) => ({ value, label: value }))],
  [
    'locations',
    'Locations',
    (l) => l.locations.map((item) => ({ value: item.id, label: item.name })),
  ],
  ['designations', 'Designations', (l) => l.designations.map((value) => ({ value, label: value }))],
  ['grades', 'Grades', (l) => l.grades.map((value) => ({ value, label: value }))],
  ['religions', 'Religion', (l) => l.religions.map((value) => ({ value, label: value }))],
  ['jobTitles', 'Job Titles', (l) => l.jobTitles.map((value) => ({ value, label: value }))],
  [
    'nationalities',
    'Nationalities',
    (l) => l.nationalities.map((value) => ({ value, label: value })),
  ],
  ['areas', 'Areas', (l) => l.areas.map((item) => ({ value: item.id, label: item.name }))],
  ['branches', 'Branches', (l) => l.branches.map((item) => ({ value: item.id, label: item.name }))],
]

function isEmpty(row: AudienceCriteria) {
  return row.target === 'employees'
    ? row.employeeIds.length === 0
    : FIELDS.every(([field]) => row[field].length === 0) && !row.joiningFrom && !row.joiningTo
}

/** "Departments: Software · Branches: Johar Town" for a saved criteria. */
function summary(row: AudienceCriteria, lookups: SettingsLookups | undefined): string {
  if (!lookups) return ''
  if (row.target === 'employees') {
    const names = lookups.employees
      .filter((item) => row.employeeIds.includes(item.id))
      .map((item) => item.name)
    return `Employees: ${names.join(', ')}`
  }
  const parts = FIELDS.flatMap(([field, label, options]) => {
    if (row[field].length === 0) return []
    const labels = options(lookups)
      .filter((option) => row[field].includes(option.value))
      .map((option) => option.label)
    return [`${label}: ${labels.join(', ')}`]
  })
  if (row.joiningFrom || row.joiningTo) {
    parts.push(`Joined ${row.joiningFrom ?? '…'} to ${row.joiningTo ?? '…'}`)
  }
  return parts.join(' · ')
}

/**
 * "Add Criteria": who a rule applies to. Each block is the organisation
 * (departments, locations, grades… joining dates) or named employees; Save
 * folds a block into a summary, Delete removes it.
 */
export function CriteriaEditor({
  value,
  onChange,
  error,
}: {
  value: AudienceCriteria[]
  onChange: (value: AudienceCriteria[]) => void
  error?: string | undefined
}) {
  const lookups = useSettingsLookups()
  const [editing, setEditing] = useState<ReadonlySet<string>>(
    () => new Set(value.filter(isEmpty).map((row) => row.id)),
  )
  const [blockError, setBlockError] = useState<string | null>(null)
  const update = (id: string, patch: Partial<AudienceCriteria>) => {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  const toggle = (id: string, on: boolean) => {
    setEditing((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <section aria-label="Criteria" className="grid gap-4">
      {value.map((row, index) => {
        const open = editing.has(row.id)
        return (
          <div key={row.id} className="grid gap-4 border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-medium text-[#202020] dark:text-heading">
                Add Criteria {value.length > 1 ? index + 1 : ''}
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onChange(value.filter((item) => item.id !== row.id))
                  }}
                >
                  Delete
                </Button>
                {open ? (
                  <Button
                    size="sm"
                    className={navyButtonClass}
                    onClick={() => {
                      if (isEmpty(row)) {
                        setBlockError('Fill in at least one field before saving the criteria.')
                        return
                      }
                      setBlockError(null)
                      toggle(row.id, false)
                    }}
                  >
                    Save
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toggle(row.id, true)
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {open ? (
              <>
                <label className="flex w-fit items-center gap-2.5 text-[0.6875rem] font-medium text-grey">
                  <span className={cn(row.target === 'organization' && switchOnClass)}>
                    Organization
                  </span>
                  <Switch
                    checked={row.target === 'employees'}
                    aria-label="Criteria for named employees"
                    onCheckedChange={(checked) => {
                      update(row.id, { target: checked ? 'employees' : 'organization' })
                    }}
                    className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
                  />
                  <span className={cn(row.target === 'employees' && switchOnClass)}>Employees</span>
                </label>
                {row.target === 'employees' ? (
                  <MultiSelect
                    label="Employees"
                    options={(lookups.data?.employees ?? []).map((item) => ({
                      value: item.id,
                      label: `${item.name} (${item.code})`,
                    }))}
                    value={row.employeeIds}
                    onChange={(employeeIds) => {
                      update(row.id, { employeeIds })
                    }}
                    className="max-w-xl"
                  />
                ) : (
                  <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
                    {FIELDS.map(([field, label, options]) => (
                      <MultiSelect
                        key={field}
                        label={label}
                        options={lookups.data ? options(lookups.data) : []}
                        value={row[field]}
                        onChange={(next) => {
                          update(row.id, { [field]: next })
                        }}
                      />
                    ))}
                    <DateBox
                      label="Joining Start Date"
                      variant="form"
                      value={row.joiningFrom ?? ''}
                      onChange={(joiningFrom) => {
                        update(row.id, { joiningFrom })
                      }}
                    />
                    <DateBox
                      label="Joining End Date"
                      variant="form"
                      value={row.joiningTo ?? ''}
                      onChange={(joiningTo) => {
                        update(row.id, { joiningTo })
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-grey">{summary(row, lookups.data)}</p>
            )}
          </div>
        )
      })}

      {(blockError ?? error) && (
        <p role="alert" className="text-xs text-destructive">
          {blockError ?? error}
        </p>
      )}

      <Button
        variant="secondary"
        onClick={() => {
          const row = newCriteria()
          onChange([...value, row])
          toggle(row.id, true)
        }}
        className={cn('w-fit bg-muted text-heading hover:bg-chip')}
      >
        <PlusCircle className="fill-heading text-muted" /> Add Criteria
      </Button>
    </section>
  )
}
