import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  ChecklistInput,
  EmployeeCardInfo,
  EndOfEmploymentDetail,
  EndOfEmploymentInput,
  EndOfEmploymentRow,
  EoeImportRow,
  EoeScope,
  ListParams,
  OffboardingChecklist,
  OffboardingLookups,
} from '../types/offboarding.types'

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/offboarding${rest}`

async function getData<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string) {
  await apiClient.delete(path(url))
}

export type PageQuery<F> = ListParams & F

export interface EoeFilters {
  scope: EoeScope
  locationId?: string | undefined
  branchId?: string | undefined
  department?: string | undefined
  employeeId?: string | undefined
  designation?: string | undefined
  status?: string | undefined
  /** `yes` / `no`. */
  noticePeriod?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface ChecklistFilters {
  name?: string | undefined
  code?: string | undefined
}

export interface ImportResult {
  created: number
  errors: string[]
}

export const offboardingApi = {
  lookups: (signal?: AbortSignal) => getData<OffboardingLookups>('/lookups', undefined, signal),
  employeeCard: (employeeId: string, signal?: AbortSignal) =>
    getData<EmployeeCardInfo>(`/employees/${employeeId}/card`, undefined, signal),

  // End of Employment
  endOfEmployments: (params: PageQuery<EoeFilters>, signal?: AbortSignal) =>
    getPage<EndOfEmploymentRow>('/end-of-employment', params, signal),
  endOfEmployment: (id: string, signal?: AbortSignal) =>
    getData<EndOfEmploymentDetail>(`/end-of-employment/${id}`, undefined, signal),
  createEndOfEmployment: (input: EndOfEmploymentInput) =>
    send<EndOfEmploymentDetail>('post', '/end-of-employment', input),
  updateEndOfEmployment: (id: string, input: EndOfEmploymentInput) =>
    send<EndOfEmploymentDetail>('put', `/end-of-employment/${id}`, input),
  deleteEndOfEmployment: (id: string) => remove(`/end-of-employment/${id}`),
  rehire: (id: string, joiningDate: string) =>
    send<EndOfEmploymentDetail>('post', `/end-of-employment/${id}/rehire`, { joiningDate }),
  importEndOfEmployments: (rows: EoeImportRow[]) =>
    send<ImportResult>('post', '/end-of-employment/import', { rows }),

  // Settings → Off Boarding Checklist
  checklists: (params: PageQuery<ChecklistFilters>, signal?: AbortSignal) =>
    getPage<OffboardingChecklist>('/checklists', params, signal),
  checklist: (id: string, signal?: AbortSignal) =>
    getData<OffboardingChecklist>(`/checklists/${id}`, undefined, signal),
  createChecklist: (input: ChecklistInput) =>
    send<OffboardingChecklist>('post', '/checklists', input),
  updateChecklist: (id: string, input: ChecklistInput) =>
    send<OffboardingChecklist>('put', `/checklists/${id}`, input),
}

export const offboardingKeys = {
  all: ['offboarding'] as const,
  lookups: () => [...offboardingKeys.all, 'lookups'] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...offboardingKeys.all, name, compact(params)] as const)
      : ([...offboardingKeys.all, name] as const),
  detail: (name: string, id: string) => [...offboardingKeys.all, name, 'detail', id] as const,
}

export const offboardingLookupsQueryOptions = () =>
  queryOptions({
    queryKey: offboardingKeys.lookups(),
    queryFn: ({ signal }) => offboardingApi.lookups(signal),
    staleTime: 30_000,
  })

export const offboardingListQueryOptions = <TRow, TParams extends object>(
  name: string,
  params: TParams,
  fetch: (params: TParams, signal?: AbortSignal) => Promise<Paginated<TRow>>,
) =>
  queryOptions({
    queryKey: offboardingKeys.list(name, params),
    queryFn: ({ signal }) => fetch(params, signal),
    placeholderData: keepPreviousData,
  })
