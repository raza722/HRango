import { useState } from 'react'
import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { FormField } from '@/components/form'
import { EmployeeAvatar } from '@/components/layout'
import { SearchSelect, SearchSelectField } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { useCityOptions } from '../../hooks/use-lookups'
import { withKnown } from '../../utils/options'

/**
 * City: a country picker (Pakistan first) and a searchable city of that country, each city
 * hinted with its state. The record's own city stays named even if it is elsewhere.
 */
export function CityField<T extends FieldValues>({
  control,
  name,
  knownId,
  knownName,
  label = 'City',
}: {
  control: Control<T>
  name: FieldPathByValue<T, string | null>
  knownId?: string | null | undefined
  knownName?: string | null | undefined
  label?: string
}) {
  const [countryId, setCountryId] = useState<string | null>(null)
  const cities = useCityOptions(countryId)
  return (
    <div className="grid gap-5 @xl:grid-cols-2">
      <FormField label="Country">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={cities.countryId}
            onChange={(next) => {
              setCountryId(next)
            }}
            options={cities.countries}
            placeholder="Select Country"
          />
        )}
      </FormField>
      <SearchSelectField
        control={control}
        name={name}
        label={label}
        options={withKnown(cities.options, knownId, knownName)}
        placeholder={
          cities.isPending
            ? 'Loading cities…'
            : cities.hasCountry
              ? 'Select City'
              : 'Choose a country first'
        }
        clearable
        loading={cities.isPending}
      />
    </div>
  )
}

/** A candidate's name with initials and a second line (email, current role). */
export function CandidateCell({
  name,
  detail,
  className,
}: {
  name: string
  detail?: string | null | undefined
  className?: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <EmployeeAvatar name={name} photoUrl={null} className="size-7 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-heading">{name}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </span>
  )
}
