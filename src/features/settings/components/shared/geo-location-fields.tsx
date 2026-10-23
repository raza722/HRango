import { useFormContext, useWatch } from 'react-hook-form'

import { TextField } from '@/components/form'
import { type Coordinates, LocationMap } from '@/components/map'

import { latitudeSchema, longitudeSchema } from '../../schemas/shared'
import { LocationSearch } from './location-search'
import { settingsType } from './type-styles'

/** The slice of a form these fields read and write. */
interface CoordinateFormValues {
  latitude: string
  longitude: string
}

function parseCoordinates(latitude: string, longitude: string): Coordinates | null {
  if (latitude.trim() === '' || longitude.trim() === '') return null
  if (
    !latitudeSchema.safeParse(latitude).success ||
    !longitudeSchema.safeParse(longitude).success
  ) {
    return null
  }
  return { latitude: Number(latitude), longitude: Number(longitude) }
}

interface GeoLocationFieldsProps {
  disabled?: boolean
  /** Name for the map region, e.g. "Branch location". */
  mapLabel: string
}

/**
 * Latitude, Longitude, "Search Location" and the map, kept in sync: type the
 * numbers, search for a place, click the map or drag the pin.
 * Use inside a `FormProvider` whose values include `latitude` and `longitude`.
 */
export function GeoLocationFields({ disabled = false, mapLabel }: GeoLocationFieldsProps) {
  const { control, setValue } = useFormContext<CoordinateFormValues>()
  const [latitude, longitude] = useWatch({ control, name: ['latitude', 'longitude'] })
  const pin = parseCoordinates(latitude, longitude)

  const setPin = ({ latitude: lat, longitude: lng }: Coordinates) => {
    const options = { shouldDirty: true, shouldValidate: true, shouldTouch: true }
    setValue('latitude', lat.toFixed(6).replace(/\.?0+$/, ''), options)
    setValue('longitude', lng.toFixed(6).replace(/\.?0+$/, ''), options)
  }

  return (
    <>
      <TextField
        control={control}
        name="latitude"
        label="Latitude"
        placeholder="e.g. 31.5204"
        inputMode="decimal"
        autoComplete="off"
      />
      <TextField
        control={control}
        name="longitude"
        label="Longitude"
        placeholder="e.g. 74.3587"
        inputMode="decimal"
        autoComplete="off"
      />
      <div className="grid gap-3 pt-1 @[72rem]:col-span-2">
        <LocationSearch
          disabled={disabled}
          inputClassName={settingsType.locationSearchInput}
          onSelect={(place) => {
            setPin(place)
          }}
        />
        <LocationMap value={pin} onChange={setPin} disabled={disabled} label={mapLabel} />
        <p className="text-xs text-muted-foreground">
          Click the map or drag the pin to set the coordinates. Used for location-based attendance.
        </p>
      </div>
    </>
  )
}
