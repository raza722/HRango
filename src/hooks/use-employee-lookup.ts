import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Paginated, PaginationMeta } from '@/types/api'

import { useDebouncedValue } from './use-debounced-value'

/*
 * `GET /employees/lookup`: the people the caller reaches through a permission code, searched
 * on the server (`q`: code or name) and paged (`page`, `pageSize` up to 100) → `{data, meta}`.
 * Every employee picker uses it, so a company with more people than one page still works:
 * typing searches the server, and "Load more" reads the next page.
 */

/** A `GET /employees/lookup` row. */
export interface EmployeeLookupRow {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string
  status: string
  photoUrl: string | null
}

/** What narrows the people (besides the search). */
export interface EmployeeLookupFilters {
  /** The code the screen itself requires, e.g. `requests.leave.create`. */
  permission?: string | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  /** Former employees too (lists and filters; not for new records). */
  includeInactive?: boolean | undefined
}

export interface EmployeeLookupParams extends EmployeeLookupFilters {
  q?: string | undefined
  page?: number | undefined
  /** 1–100. */
  pageSize?: number | undefined
}

/** People per page of a picker. */
export const EMPLOYEE_LOOKUP_PAGE_SIZE = 50

const compact = (params: EmployeeLookupParams) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== false,
    ),
  ) as Record<string, string | number | boolean>

/** One page of `GET /employees/lookup`. */
export async function fetchEmployeeLookup<T extends { id: string } = EmployeeLookupRow>(
  params: EmployeeLookupParams,
  signal?: AbortSignal,
): Promise<Paginated<T>> {
  // `meta` is missing only from older stand-ins (mocks) that answer a plain list.
  const { data } = await apiClient.get<{ data: T[]; meta?: PaginationMeta }>('/employees/lookup', {
    params: compact({ pageSize: EMPLOYEE_LOOKUP_PAGE_SIZE, ...params }),
    signal,
  })
  const pageSize = params.pageSize ?? EMPLOYEE_LOOKUP_PAGE_SIZE
  return {
    data: data.data,
    meta: data.meta ?? { page: params.page ?? 1, pageSize, total: data.data.length, totalPages: 1 },
  }
}

/**
 * Every person `GET /employees/lookup` gives (all pages, 100 at a time), for the few
 * screens that need the whole list at once (e.g. a department column of everyone).
 * Stops after `maxPages` pages.
 */
export async function fetchAllEmployeeLookup<T extends { id: string } = EmployeeLookupRow>(
  params: Omit<EmployeeLookupParams, 'page' | 'pageSize'>,
  signal?: AbortSignal,
  maxPages = 20,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchEmployeeLookup<T>({ ...params, page, pageSize: 100 }, signal)
    rows.push(...result.data)
    if (result.meta.page >= result.meta.totalPages || result.data.length === 0) break
  }
  return rows
}

export const employeeLookupKeys = {
  all: ['employees', 'lookup'] as const,
  filtered: (filters: EmployeeLookupFilters) =>
    [...employeeLookupKeys.all, compact(filters)] as const,
  search: (filters: EmployeeLookupFilters, q: string, pageSize: number) =>
    [...employeeLookupKeys.filtered(filters), q, pageSize] as const,
}

interface SearchOptions {
  /** The text typed in the picker; searched on the server once typing pauses. */
  search?: string
  enabled?: boolean
  pageSize?: number
}

/**
 * A picker's people: the first page for `search` (debounced), more with `loadMore`.
 * `find(id)` names someone from any page read under the same filters, so a choice keeps
 * its name when a later search hides it.
 */
export function useEmployeeLookupSearch<T extends { id: string } = EmployeeLookupRow>(
  filters: EmployeeLookupFilters,
  { search = '', enabled = true, pageSize = EMPLOYEE_LOOKUP_PAGE_SIZE }: SearchOptions = {},
) {
  const q = useDebouncedValue(search.trim(), 300)
  const queryClient = useQueryClient()
  const query = useInfiniteQuery({
    queryKey: employeeLookupKeys.search(filters, q, pageSize),
    queryFn: ({ pageParam, signal }) =>
      fetchEmployeeLookup<T>({ ...filters, q: q || undefined, page: pageParam, pageSize }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const rows = query.data?.pages.flatMap((page) => page.data) ?? []
  const find = (id: string | null | undefined): T | undefined => {
    if (!id) return undefined
    const match = rows.find((row) => row.id === id)
    if (match) return match
    for (const [, data] of queryClient.getQueriesData<InfiniteData<Paginated<T>>>({
      queryKey: employeeLookupKeys.filtered(filters),
    })) {
      const found = data?.pages.flatMap((page) => page.data).find((row) => row.id === id)
      if (found) return found
    }
    return undefined
  }
  return {
    rows,
    total: query.data?.pages[0]?.meta.total ?? 0,
    hasMore: query.hasNextPage,
    loadMore: () => {
      void query.fetchNextPage()
    },
    find,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
  }
}
