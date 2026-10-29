import { useId } from 'react'
import { type Control, useController } from 'react-hook-form'

import { EmployeeMultiSearchSelectField, MultiSearchSelectField } from '@/features/payroll'

import { AUDIENCE_LABELS, CF_CODES } from '../../constants'
import { useOrgOptions } from '../../hooks/use-custom-forms'
import type { BuilderValues } from '../../schemas/builder.schema'
import { AUDIENCE_KINDS, type NamedRef } from '../../types/custom-forms.types'

const HINTS = {
  everyone: 'Every employee sees it in My Forms.',
  departments: 'People in the departments you pick.',
  branches: 'People at the branches you pick.',
  people: 'Only the people you pick.',
} as const

/**
 * Who the form is for: everyone, departments, branches (the organisation lookups) or people
 * (the employee picker other modules use). Only the chosen kind's picker shows.
 */
export function AudienceFields({
  control,
  known,
}: {
  control: Control<BuilderValues>
  /** The saved form's targets, so chosen names show before the pickers load. */
  known: readonly NamedRef[]
}) {
  const groupId = useId()
  const { field } = useController({ control, name: 'audienceKind' })
  const kind = field.value
  const departments = useOrgOptions('departments', kind === 'departments')
  const branches = useOrgOptions('branches', kind === 'branches')
  const withKnown = (options: { value: string; label: string }[]) => [
    ...options,
    ...known
      .filter((target) => !options.some((option) => option.value === target.id))
      .map((target) => ({ value: target.id, label: target.name })),
  ]

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-sm text-title dark:text-heading">Who is it for?</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {AUDIENCE_KINDS.map((option) => (
            <label
              key={option}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-[5px] border border-[#CFCFCF] px-3 text-sm text-title has-checked:border-sidebar has-checked:bg-sidebar/5 has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:border-input dark:text-heading dark:has-checked:border-primary"
            >
              <input
                type="radio"
                name={`${groupId}-audience`}
                value={option}
                checked={kind === option}
                onChange={() => {
                  field.onChange(option)
                }}
                className="size-4 accent-[#17263A] dark:accent-[#8B5CF6]"
              />
              {AUDIENCE_LABELS[option]}
            </label>
          ))}
        </div>
        <p className="text-xs text-grey">{HINTS[kind]}</p>
      </fieldset>
      {kind === 'departments' && (
        <MultiSearchSelectField
          control={control}
          name="departmentIds"
          label="Departments"
          required
          placeholder={departments.isPending ? 'Loading departments…' : 'Select departments'}
          options={withKnown(departments.options)}
        />
      )}
      {kind === 'branches' && (
        <MultiSearchSelectField
          control={control}
          name="branchIds"
          label="Branches"
          required
          placeholder={branches.isPending ? 'Loading branches…' : 'Select branches'}
          options={withKnown(branches.options)}
        />
      )}
      {kind === 'people' && (
        <EmployeeMultiSearchSelectField
          control={control}
          name="employeeIds"
          label="People"
          required
          placeholder="Select employees"
          filters={{ permission: CF_CODES.formsEdit }}
          known={known.map((target) => ({ value: target.id, label: target.name }))}
        />
      )}
    </div>
  )
}
