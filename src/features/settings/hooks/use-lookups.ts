import { useQuery } from '@tanstack/react-query'

import type { SelectOption } from '@/components/form'

import {
  citiesQueryOptions,
  companiesQueryOptions,
  countriesQueryOptions,
  orgLookupQueryOptions,
  statesQueryOptions,
} from '../api/lookups.api'

interface OptionsResult {
  options: SelectOption[]
  isLoading: boolean
}

function toOptions<T>(
  items: readonly T[] | undefined,
  value: (item: T) => string,
  label: (item: T) => string,
): SelectOption[] {
  return (items ?? []).map((item) => ({ value: value(item), label: label(item) }))
}

/** Companies the user may switch to. */
export function useCompanyOptions(): OptionsResult {
  const query = useQuery(companiesQueryOptions())
  return {
    options: toOptions(
      query.data,
      (c) => c.id,
      (c) => c.name,
    ),
    isLoading: query.isPending,
  }
}

export function useCountryOptions(): OptionsResult {
  const query = useQuery(countriesQueryOptions())
  return {
    options: toOptions(
      query.data,
      (c) => c.id,
      (c) => c.name,
    ),
    isLoading: query.isPending,
  }
}

export function useStateOptions(countryId: string): OptionsResult {
  const query = useQuery(statesQueryOptions(countryId))
  return {
    options: toOptions(
      query.data,
      (s) => s.id,
      (s) => s.name,
    ),
    isLoading: countryId !== '' && query.isPending,
  }
}

/** Kept for older imports. */
export const useRegionOptions = useStateOptions

export function useCityOptions(stateId: string): OptionsResult {
  const query = useQuery(citiesQueryOptions(stateId))
  return {
    options: toOptions(
      query.data,
      (c) => c.id,
      (c) => c.name,
    ),
    isLoading: stateId !== '' && query.isPending,
  }
}

/** Locations of the active company (`GET /organisation/lookups/locations`). */
export function useLocationOptions(): OptionsResult {
  const query = useQuery(orgLookupQueryOptions('locations'))
  return {
    options: toOptions(
      query.data,
      (l) => l.id,
      (l) => l.name,
    ),
    isLoading: query.isPending,
  }
}

/** Areas of one location; idle until a location is chosen. */
export function useAreaOptions(locationId: string): OptionsResult {
  const enabled = locationId !== ''
  const query = useQuery({ ...orgLookupQueryOptions('areas', locationId), enabled })
  return {
    options: toOptions(
      query.data,
      (a) => a.id,
      (a) => a.name,
    ),
    isLoading: enabled && query.isPending,
  }
}
