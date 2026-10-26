import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { SelectField } from '@/components/form'

import { useGeoFences } from '../../hooks/use-scheduling'

interface GeoFenceSelectProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  disabled?: boolean
  /** Name of the extra first item that clears the field. */
  noneLabel?: string
}

/**
 * "Apply Geo Fence": one fence per shift (the API stores one). Fences are drawn in
 * Attendance → Settings → Geo Fencing; this only picks one (active fences).
 */
export function GeoFenceSelect<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label = 'Apply Geo Fence',
  disabled = false,
  noneLabel = 'No geo fence',
}: GeoFenceSelectProps<TFieldValues, TName>) {
  const fences = useGeoFences()
  const options = (fences.data ?? []).map((fence) => ({
    value: fence.id,
    label: fence.code ? `${fence.name} (${fence.code})` : fence.name,
  }))

  return (
    <SelectField
      control={control}
      name={name}
      label={label}
      placeholder={fences.isPending ? 'Loading geo fences…' : 'Select Geo Fence'}
      options={options}
      clearable={noneLabel}
      disabled={disabled}
      description={
        fences.isError
          ? 'Geo fences could not be loaded (Attendance settings access is needed).'
          : !fences.isPending && options.length === 0
            ? 'No geo fences yet. Draw them in Attendance → Settings → Geo Fencing.'
            : undefined
      }
    />
  )
}
