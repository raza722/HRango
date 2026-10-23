import { useQuery } from '@tanstack/react-query'

import type { SelectOption } from '@/components/form'

import {
  citiesQueryOptions,
  companiesQueryOptions,
  countriesQueryOptions,
  employeesQueryOptions,
  regionsQueryOptions,
} from '../api/lookups.api'
import { areaResource, locationResource, OPTION_LIST_SIZE } from '../api/org-resource'
import type { LocationRow } from '../types/settings.types'

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

/** Managers: name with job title, e.g. "Omar Siddiqui · Branch Manager". */
export function useManagerOptions(): OptionsResult {
  const query = useQuery(employeesQueryOptions())
  return {
    options: toOptions(
      query.data,
      (e) => e.id,
      (e) => `${e.name} · ${e.jobTitle}`,
    ),
    isLoading: query.isPending,
  }
}

export function useCountryOptions(): OptionsResult {
  const query = useQuery(countriesQueryOptions())
  return {
    options: toOptions(
      query.data,
      (c) => c.code,
      (c) => c.name,
    ),
    isLoading: query.isPending,
  }
}

export function useRegionOptions(country: string): OptionsResult {
  const query = useQuery(regionsQueryOptions(country))
  return {
    options: toOptions(
      query.data,
      (r) => r.code,
      (r) => r.name,
    ),
    isLoading: country !== '' && query.isPending,
  }
}

export function useCityOptions(region: string): OptionsResult {
  const query = useQuery(citiesQueryOptions(region))
  return {
    options: toOptions(
      query.data,
      (c) => c.id,
      (c) => c.name,
    ),
    isLoading: region !== '' && query.isPending,
  }
}

/** Locations of one company (all locations when `companyId` is empty and `all` is set). */
export function useLocationOptions(
  companyId: string,
  { all = false } = {},
): OptionsResult & { locations: LocationRow[] } {
  const enabled = all || companyId !== ''
  const query = useQuery({
    ...locationResource.listQuery({ page: 1, pageSize: OPTION_LIST_SIZE, companyId }),
    enabled,
  })
  return {
    options: toOptions(
      query.data?.data,
      (l) => l.id,
      (l) => (all && companyId === '' ? `${l.name} · ${l.companyName}` : l.name),
    ),
    isLoading: enabled && query.isPending,
    locations: query.data?.data ?? [],
  }
}

export function useAreaOptions(locationId: string): OptionsResult {
  const enabled = locationId !== ''
  const query = useQuery({
    ...areaResource.listQuery({ page: 1, pageSize: OPTION_LIST_SIZE, locationId }),
    enabled,
  })
  return {
    options: toOptions(
      query.data?.data,
      (a) => a.id,
      (a) => a.name,
    ),
    isLoading: enabled && query.isPending,
  }
}
