import { useQueries, useQuery } from '@tanstack/react-query'

import { type SearchOption } from '@/features/payroll'
import { citiesQueryOptions, countriesQueryOptions, statesQueryOptions } from '@/features/settings'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

import { recruitmentApi } from '../api/recruitment.api'
import type { Application, OpeningStatus } from '../types/recruitment.types'
import { formatDay } from '../utils/format'
import { recruitmentKeys } from './recruitment.keys'
import { useApplicants, useApplications } from './use-recruitment'

/** The organisation lists the forms and filters pick from. */
export type OrgKind =
  'branches' | 'departments' | 'job-titles' | 'designations' | 'employment-types'

const LOOKUP_STALE = 5 * 60_000

const toOptions = (rows: readonly { id: string; name: string }[] | undefined): SearchOption[] =>
  (rows ?? []).map((row) => ({ value: row.id, label: row.name }))

/**
 * `GET /organisation/lookups/{kind}` for each kind, read once `enabled`; a list the user may not
 * read is empty. Answers picker options by kind.
 */
export function useOrgOptions<K extends OrgKind>(kinds: readonly K[], enabled = true) {
  const results = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: recruitmentKeys.lookup(`org-${kind}`),
      queryFn: ({ signal }: { signal: AbortSignal }) => recruitmentApi.orgLookup(kind, signal),
      staleTime: LOOKUP_STALE,
      enabled,
    })),
  })
  return Object.fromEntries(
    kinds.map((kind, index) => [kind, toOptions(results[index]?.data)]),
  ) as Record<K, SearchOption[]>
}

/** Manpower Planning's active open positions, for the opening form. */
export function useOpenPositionOptions(enabled = true) {
  const query = useQuery({
    queryKey: recruitmentKeys.lookup('open-positions'),
    queryFn: ({ signal }) => recruitmentApi.openPositions(signal),
    staleTime: LOOKUP_STALE,
    enabled,
  })
  return {
    rows: query.data ?? [],
    options: (query.data ?? []).map((row): SearchOption => ({
      value: row.id,
      label: row.title,
      hint: `${String(row.totalPositions)} position${row.totalPositions === 1 ? '' : 's'}`,
    })),
  }
}

/** Every opening (all pages), optionally of one status: the pickers and filters. */
export function useOpeningOptions(status?: OpeningStatus) {
  const query = useQuery({
    queryKey: recruitmentKeys.lookup(`openings-${status ?? 'all'}`),
    queryFn: ({ signal }) => recruitmentApi.allOpenings({ status }, signal),
    staleTime: 30_000,
  })
  return {
    openings: query.data ?? [],
    options: (query.data ?? []).map((row): SearchOption => ({
      value: row.id,
      label: row.title,
      hint: row.code,
    })),
    isPending: query.isPending,
  }
}

/** The active rejection reasons, in their order (the Reject dialog). */
export function useReasonOptions(enabled = true) {
  const query = useQuery({
    queryKey: recruitmentKeys.list('rejection-reasons', { activeOnly: true }),
    queryFn: ({ signal }) => recruitmentApi.rejectionReasons({ activeOnly: true }, signal),
    enabled,
  })
  return {
    options: (query.data ?? [])
      .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((row): SearchOption => ({ value: row.id, label: row.name })),
    isPending: query.isPending,
  }
}

/** Candidates matching the typed text (server search), for the New Application picker. */
export function useApplicantSearch(text: string, enabled = true) {
  const q = useDebouncedValue(text.trim(), 300)
  const query = useApplicants({ q: q || undefined, page: 1, pageSize: 20 }, enabled)
  return {
    options: (query.data?.data ?? []).map((row): SearchOption => ({
      value: row.id,
      label: row.fullName,
      hint: row.email,
    })),
    loading: query.isFetching,
  }
}

const applicationOption = (row: Application): SearchOption => ({
  value: row.id,
  label: row.applicantName,
  hint: `${row.jobOpeningTitle} · applied ${formatDay(row.appliedOn)}`,
})

/** Applications still in the pipeline matching the typed text (Schedule Interview, New Offer). */
export function useApplicationSearch(text: string, enabled = true) {
  const q = useDebouncedValue(text.trim(), 300)
  const query = useApplications(
    { q: q || undefined, activeOnly: true, page: 1, pageSize: 20 },
    enabled,
  )
  return {
    rows: query.data?.data ?? [],
    options: (query.data?.data ?? []).map(applicationOption),
    loading: query.isFetching,
  }
}

/**
 * Cities of a country, for one searchable City field: the states (`/organisation/geo/states`),
 * then each state's cities, named "Lahore" with the state as the hint. Without a country, the
 * first country named Pakistan (else the first listed) is used.
 */
export function useCityOptions(countryId: string | null, enabled = true) {
  const countries = useQuery({ ...countriesQueryOptions(), enabled })
  const list = countries.data ?? []
  const country =
    (countryId ? list.find((row) => row.id === countryId) : undefined) ??
    list.find((row) => row.code === 'PK') ??
    list[0]
  const states = useQuery({
    ...statesQueryOptions(country?.id ?? ''),
    enabled: enabled && !!country,
  })
  const stateRows = states.data ?? []
  const cities = useQueries({
    queries: stateRows.map((state) => ({ ...citiesQueryOptions(state.id), enabled })),
  })
  const options: SearchOption[] = cities.flatMap((result, index) =>
    (result.data ?? []).map((city) => ({
      value: city.id,
      label: city.name,
      hint: stateRows[index]?.name ?? '',
    })),
  )
  return {
    countries: list.map((row): SearchOption => ({ value: row.id, label: row.name })),
    countryId: country?.id ?? null,
    options: options.toSorted((a, b) => a.label.localeCompare(b.label)),
    // Without a country nothing loads (a disabled query stays pending): not "Loading".
    hasCountry: country !== undefined,
    isPending:
      countries.isPending ||
      (country !== undefined && (states.isPending || cities.some((city) => city.isPending))),
  }
}
