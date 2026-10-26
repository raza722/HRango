import type { ReactNode } from 'react'
import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { EmployeeSearchSelect, EmployeeSearchSelectField } from '@/features/payroll'
import type { EmployeeLookupRow } from '@/hooks/use-employee-lookup'

import { type PersonOption, toPersonOption } from '../../api/lookups.api'
import { knownPeople, type KnownPerson, requestEmployeeFilters } from './request-employee'

interface RequestEmployeePickerOptions {
  /** The screen's permission code: whom the caller may pick (`typePermission(kind, 'create')`). */
  permission: string
  /**
   * People named before the lookup reads them (the request's own employee, a saved
   * approver …); they stay choosable even when they have left.
   */
  current?: KnownPerson | readonly (KnownPerson | null | undefined)[] | null | undefined
  /** Ids left out of the matches (the requester, the signed-in person …). */
  exclude?: readonly (string | null | undefined)[] | undefined
  /** Former employees too (default: active people only, plus `current`). */
  includeInactive?: boolean | undefined
  /** The line under the name (default: the code). */
  hint?: ((person: PersonOption) => string) | undefined
  /** False: read nothing (a locked picker named by `current`). Default true. */
  enabled?: boolean | undefined
}

/** The picker's props from the options: filters, known names, who shows, the second line. */
function pickerProps({
  permission,
  current,
  exclude,
  includeInactive = false,
  hint,
  enabled,
}: RequestEmployeePickerOptions) {
  const known = knownPeople(
    current === null || current === undefined
      ? []
      : Array.isArray(current)
        ? (current as readonly (KnownPerson | null | undefined)[])
        : [current as KnownPerson],
  )
  const left = new Set(exclude?.filter((id): id is string => Boolean(id)))
  return {
    filters: requestEmployeeFilters(permission, includeInactive),
    known,
    include: (row: EmployeeLookupRow) =>
      !left.has(row.id) &&
      (includeInactive || row.status === 'active' || known.some((item) => item.value === row.id)),
    hint: hint ? (row: EmployeeLookupRow) => hint(toPersonOption(row)) : undefined,
    enabled,
  }
}

interface RequestEmployeeFieldProps<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
> extends RequestEmployeePickerOptions {
  control: Control<T>
  name: N
  /** Default "Employee". */
  label?: ReactNode
  /** Default "Select". */
  placeholder?: string
  required?: boolean
  disabled?: boolean
  clearable?: boolean
  className?: string
  /** After a pick: the id and the person (department, designation, branch) when read. */
  onPick?: (id: string | null, person: PersonOption | undefined) => void
}

/**
 * A request form's "Employee" picker: `GET /employees/lookup?permission=` searched on the
 * server as you type, paged ("Load more"), so it works for any number of people.
 * `useRequestPerson(permission, id)` gives the picked person.
 */
export function RequestEmployeeField<
  T extends FieldValues,
  N extends FieldPathByValue<T, string | null>,
>({
  control,
  name,
  label = 'Employee',
  placeholder = 'Select',
  required,
  disabled,
  clearable,
  className,
  onPick,
  ...options
}: RequestEmployeeFieldProps<T, N>) {
  return (
    <EmployeeSearchSelectField
      control={control}
      name={name}
      label={label}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      clearable={clearable}
      className={className}
      {...pickerProps(options)}
      onValueChange={(id, row) => {
        onPick?.(id, row ? toPersonOption(row) : undefined)
      }}
    />
  )
}

interface RequestEmployeeSelectProps extends RequestEmployeePickerOptions {
  id?: string
  value: string | null | undefined
  onChange: (id: string | null, person: PersonOption | undefined) => void
  placeholder: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** `RequestEmployeeField` outside a form (dialogs holding their own state). */
export function RequestEmployeeSelect({
  permission,
  current,
  exclude,
  includeInactive,
  hint,
  enabled,
  onChange,
  ...rest
}: RequestEmployeeSelectProps) {
  return (
    <EmployeeSearchSelect
      {...rest}
      {...pickerProps({ permission, current, exclude, includeInactive, hint, enabled })}
      onChange={(id, row) => {
        onChange(id, row ? toPersonOption(row) : undefined)
      }}
    />
  )
}
