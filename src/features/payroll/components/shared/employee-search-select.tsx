import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { FormField } from '@/components/form'
import {
  type EmployeeLookupFilters,
  type EmployeeLookupRow,
  useEmployeeLookupSearch,
} from '@/hooks/use-employee-lookup'

import { MultiSearchSelect } from './multi-search-select'
import { type SearchOption, SearchSelect } from './search-select'

interface EmployeePickerOptions {
  /** Whom the list holds: the screen's permission code, branch, department, former staff. */
  filters: EmployeeLookupFilters
  /** People to name even when no page read so far has them (e.g. a record's own employee). */
  known?: readonly SearchOption[] | undefined
  /** Leave someone out of the matches (the chosen ones always show). */
  include?: ((row: EmployeeLookupRow) => boolean) | undefined
  /** The second line (default: the code). */
  hint?: ((row: EmployeeLookupRow) => string) | undefined
  enabled?: boolean | undefined
}

const toOption = (row: EmployeeLookupRow, hint?: (row: EmployeeLookupRow) => string) => ({
  value: row.id,
  label: row.name,
  hint: hint ? hint(row) : row.code,
})

/** The matches of the typed text, the chosen people first (named from any page read). */
function useEmployeeOptions(
  chosen: readonly string[],
  { filters, known, include, hint, enabled = true }: EmployeePickerOptions,
) {
  const [search, setSearch] = useState('')
  const lookup = useEmployeeLookupSearch(filters, { search, enabled })
  const matches = lookup.rows
    .filter((row) => !include || include(row) || chosen.includes(row.id))
    .map((row) => toOption(row, hint))
  const extra = chosen
    .filter((id) => !matches.some((option) => option.value === id))
    .map((id): SearchOption => {
      const row = lookup.find(id)
      return row
        ? toOption(row, hint)
        : (known?.find((option) => option.value === id) ?? { value: id, label: `Employee ${id}` })
    })
  return {
    lookup,
    options: [...extra, ...matches],
    server: {
      onSearch: setSearch,
      loading: lookup.isFetching,
      hasMore: lookup.hasMore,
      onLoadMore: lookup.loadMore,
    },
  }
}

interface EmployeeSearchSelectProps extends EmployeePickerOptions {
  id?: string
  value: string | null | undefined
  /** The id, and the row when it came from the lookup. */
  onChange: (value: string | null, row: EmployeeLookupRow | undefined) => void
  placeholder: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/**
 * "Select Employee": `SearchSelect` over `GET /employees/lookup`, searched on the server as
 * you type and paged ("Load more"), so it works for any number of people.
 */
export function EmployeeSearchSelect({
  value,
  onChange,
  filters,
  known,
  include,
  hint,
  enabled,
  ...rest
}: EmployeeSearchSelectProps) {
  const { lookup, options, server } = useEmployeeOptions(value ? [value] : [], {
    filters,
    known,
    include,
    hint,
    enabled,
  })
  return (
    <SearchSelect
      {...rest}
      {...server}
      value={value}
      onChange={(next) => {
        onChange(next, lookup.find(next))
      }}
      options={options}
    />
  )
}

interface EmployeeSearchSelectFieldProps<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
> extends EmployeePickerOptions {
  control: Control<T>
  name: N
  label: ReactNode
  placeholder: string
  required?: boolean
  disabled?: boolean
  className?: string
  clearable?: boolean
  /** After a pick: the id and its lookup row (department, branch, designation …). */
  onValueChange?: (value: string | null, row: EmployeeLookupRow | undefined) => void
}

/** `EmployeeSearchSelect` as a form field (label, error, required mark). */
export function EmployeeSearchSelectField<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
>({
  control,
  name,
  label,
  required,
  className,
  onValueChange,
  ...rest
}: EmployeeSearchSelectFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <EmployeeSearchSelect
          {...a11y}
          {...rest}
          value={field.value}
          onChange={(next, row) => {
            field.onChange(next)
            onValueChange?.(next, row)
          }}
        />
      )}
    </FormField>
  )
}

interface EmployeeMultiSearchSelectProps extends EmployeePickerOptions {
  id?: string
  value: readonly string[]
  onChange: (value: string[]) => void
  placeholder: string
  disabled?: boolean
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** "Select Employees": `MultiSearchSelect` over `GET /employees/lookup` (server search, paged). */
export function EmployeeMultiSearchSelect({
  value,
  filters,
  known,
  include,
  hint,
  enabled,
  ...rest
}: EmployeeMultiSearchSelectProps) {
  const { options, server } = useEmployeeOptions(value, {
    filters,
    known,
    include,
    hint,
    enabled,
  })
  return <MultiSearchSelect {...rest} {...server} value={value} options={options} />
}

interface EmployeeMultiSearchSelectFieldProps<
  T extends FieldValues,
  N extends FieldPathByValue<T, string[]>,
> extends EmployeePickerOptions {
  control: Control<T>
  name: N
  label: ReactNode
  placeholder: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/** `EmployeeMultiSearchSelect` as a form field. */
export function EmployeeMultiSearchSelectField<
  T extends FieldValues,
  N extends FieldPathByValue<T, string[]>,
>({
  control,
  name,
  label,
  required,
  className,
  ...rest
}: EmployeeMultiSearchSelectFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <EmployeeMultiSearchSelect
          {...a11y}
          {...rest}
          value={field.value}
          onChange={field.onChange}
        />
      )}
    </FormField>
  )
}
