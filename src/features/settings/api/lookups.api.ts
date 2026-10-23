import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  City,
  Company,
  Country,
  Employee,
  GeneralSettings,
  GeneralSettingsInput,
  GeoPlace,
  Region,
} from '../types/settings.types'
import { SETTINGS_QUERY_ROOT } from './org-resource'

async function getData<T>(path: string, params?: Record<string, string>, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, { params, signal })
  return data.data
}

/** Reference lists change rarely; keep them for the whole session. */
const STATIC = { staleTime: Number.POSITIVE_INFINITY } as const

export const lookupKeys = {
  all: [SETTINGS_QUERY_ROOT, 'lookups'] as const,
  companies: () => [...lookupKeys.all, 'companies'] as const,
  employees: () => [...lookupKeys.all, 'employees'] as const,
  countries: () => [...lookupKeys.all, 'countries'] as const,
  regions: (country: string) => [...lookupKeys.all, 'regions', country] as const,
  cities: (region: string) => [...lookupKeys.all, 'cities', region] as const,
  places: (query: string) => [...lookupKeys.all, 'places', query] as const,
}

export const companiesQueryOptions = () =>
  queryOptions({
    queryKey: lookupKeys.companies(),
    queryFn: ({ signal }) => getData<Company[]>('/companies', undefined, signal),
    ...STATIC,
  })

export const employeesQueryOptions = () =>
  queryOptions({
    queryKey: lookupKeys.employees(),
    queryFn: ({ signal }) => getData<Employee[]>('/employees', undefined, signal),
    staleTime: 5 * 60_000,
  })

export const countriesQueryOptions = () =>
  queryOptions({
    queryKey: lookupKeys.countries(),
    queryFn: ({ signal }) => getData<Country[]>('/geo/countries', undefined, signal),
    ...STATIC,
  })

export const regionsQueryOptions = (country: string) =>
  queryOptions({
    queryKey: lookupKeys.regions(country),
    queryFn: ({ signal }) => getData<Region[]>('/geo/regions', { country }, signal),
    enabled: country !== '',
    ...STATIC,
  })

export const citiesQueryOptions = (region: string) =>
  queryOptions({
    queryKey: lookupKeys.cities(region),
    queryFn: ({ signal }) => getData<City[]>('/geo/cities', { region }, signal),
    enabled: region !== '',
    ...STATIC,
  })

/** "Search Location": places matching the text (needs at least two characters). */
export const placesQueryOptions = (query: string) =>
  queryOptions({
    queryKey: lookupKeys.places(query.trim().toLowerCase()),
    queryFn: ({ signal }) => getData<GeoPlace[]>('/geo/search', { q: query.trim() }, signal),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

export const generalSettingsKeys = {
  all: [SETTINGS_QUERY_ROOT, 'general'] as const,
}

export const generalSettingsApi = {
  get: (signal?: AbortSignal) => getData<GeneralSettings>('/settings/general', undefined, signal),
  async update(input: GeneralSettingsInput): Promise<GeneralSettings> {
    const { data } = await apiClient.put<ApiItem<GeneralSettings>>('/settings/general', input)
    return data.data
  },
}

export const generalSettingsQueryOptions = () =>
  queryOptions({
    queryKey: generalSettingsKeys.all,
    queryFn: ({ signal }) => generalSettingsApi.get(signal),
  })
