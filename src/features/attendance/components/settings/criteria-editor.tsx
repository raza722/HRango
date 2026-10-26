import { RELIGIONS } from '../../constants'
import { useCountries, useOrgLookup } from '../../hooks/use-attendance-settings'
import type { AudienceCriteria, OrgLookupKind, TargetType } from '../../types/settings.types'
import { NATIONALITIES } from '../../utils/criteria'
import { EmployeeMultiSelect } from './employee-select'
import { MultiSelect } from './multi-select'

const ORG_FIELDS: [TargetType, string, OrgLookupKind][] = [
  ['location', 'Locations', 'locations'],
  ['branch', 'Branches', 'branches'],
  ['area', 'Areas', 'areas'],
  ['department', 'Departments', 'departments'],
  ['designation', 'Designations', 'designations'],
  ['grade', 'Grades', 'grades'],
  ['job_title', 'Job Titles', 'job-titles'],
]

function OrgField({
  kind,
  label,
  value,
  onChange,
}: {
  kind: OrgLookupKind
  label: string
  value: readonly string[]
  onChange: (value: string[]) => void
}) {
  const lookup = useOrgLookup(kind)
  const options = (lookup.data ?? []).map((item) => ({ value: item.id, label: item.name }))
  // Keep a saved choice visible even when it is no longer offered.
  const missing = value
    .filter((id) => !options.some((option) => option.value === id))
    .map((id) => ({ value: id, label: `${label} ${id}` }))
  return (
    <MultiSelect
      label={label}
      options={[...missing, ...options]}
      value={value}
      onChange={onChange}
      loading={lookup.isFetching}
    />
  )
}

/**
 * "Add Criteria": who a fence or a restriction applies to. Every field is a list of values;
 * a person matches when, for each field that has values, they match one of them (same field =
 * any, different fields = all). Named employees are one of the fields.
 */
export function CriteriaEditor({
  value,
  onChange,
  permission,
  error,
}: {
  value: AudienceCriteria
  onChange: (value: AudienceCriteria) => void
  /** The screen's permission code: the employees it reaches can be named. */
  permission: string
  error?: string | undefined
}) {
  const countries = useCountries()
  const set = (type: TargetType, next: string[]) => {
    onChange({ ...value, [type]: next })
  }
  const known = (values: readonly string[]) => values.map((item) => ({ value: item, label: item }))

  return (
    <section aria-label="Criteria" className="grid gap-4">
      <h3 className="text-lg font-medium text-[#202020] dark:text-heading">Add Criteria</h3>
      <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
        {ORG_FIELDS.map(([type, label, kind]) => (
          <OrgField
            key={type}
            kind={kind}
            label={label}
            value={value[type]}
            onChange={(next) => {
              set(type, next)
            }}
          />
        ))}
        <MultiSelect
          label="Countries"
          options={(countries.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          value={value.country}
          onChange={(next) => {
            set('country', next)
          }}
          loading={countries.isFetching}
        />
        <MultiSelect
          label="Religion"
          options={known([...new Set([...RELIGIONS, ...value.religion])])}
          value={value.religion}
          onChange={(next) => {
            set('religion', next)
          }}
        />
        <MultiSelect
          label="Nationalities"
          options={known([...new Set([...NATIONALITIES, ...value.nationality])])}
          value={value.nationality}
          onChange={(next) => {
            set('nationality', next)
          }}
        />
      </div>
      <EmployeeMultiSelect
        permission={permission}
        value={value.employee}
        onChange={(next) => {
          set('employee', next)
        }}
        className="max-w-xl"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
