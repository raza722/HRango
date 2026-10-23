import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  BenefitFileRow,
  BenefitProfile,
  BenefitProfileInput,
  BenefitsLookups,
  BenefitsSummary,
  EmployeeRow,
  EnrollmentWindowInput,
  EnrollmentWindowRow,
  PlanInput,
  PlanRow,
  PlanYearInput,
  PlanYearRow,
} from '../types/benefits.types'

const path = (rest: string) => `/benefits${rest}`

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function get<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function send<T>(method: 'post' | 'put' | 'delete', url: string, body?: unknown) {
  const { data } =
    method === 'delete'
      ? await apiClient.delete<ApiItem<T>>(path(url))
      : await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

/** The "Showing:" plan year (none: All Plan Years). */
export interface YearFilter {
  year?: string | undefined
}

export interface EmployeeFilter extends YearFilter {
  missing?: boolean | undefined
}

export const benefitsApi = {
  summary: (signal?: AbortSignal) => get<BenefitsSummary>('/summary', undefined, signal),
  lookups: (signal?: AbortSignal) => get<BenefitsLookups>('/lookups', undefined, signal),

  planYears: (filter: YearFilter, signal?: AbortSignal) =>
    get<PlanYearRow[]>('/plan-years', filter, signal),
  planYear: (id: string, signal?: AbortSignal) =>
    get<PlanYearRow>(`/plan-years/${id}`, undefined, signal),
  createPlanYear: (input: PlanYearInput) => send<PlanYearRow>('post', '/plan-years', input),
  updatePlanYear: (id: string, input: PlanYearInput) =>
    send<PlanYearRow>('put', `/plan-years/${id}`, input),
  deletePlanYear: (id: string) => send<{ id: string }>('delete', `/plan-years/${id}`),

  plans: (filter: YearFilter, signal?: AbortSignal) => get<PlanRow[]>('/plans', filter, signal),
  createPlan: (input: PlanInput) => send<PlanRow>('post', '/plans', input),
  duplicatePlan: (id: string) => send<PlanRow>('post', `/plans/${id}/duplicate`),
  deletePlan: (id: string) => send<{ id: string }>('delete', `/plans/${id}`),

  enrollmentWindows: (filter: YearFilter, signal?: AbortSignal) =>
    get<EnrollmentWindowRow[]>('/enrollment-windows', filter, signal),
  createEnrollmentWindow: (input: EnrollmentWindowInput) =>
    send<EnrollmentWindowRow>('post', '/enrollment-windows', input),
  deleteEnrollmentWindow: (id: string) =>
    send<{ id: string }>('delete', `/enrollment-windows/${id}`),

  employees: (filter: EmployeeFilter, signal?: AbortSignal) =>
    get<EmployeeRow[]>(
      '/employees',
      { year: filter.year, missing: filter.missing ? 'true' : undefined },
      signal,
    ),
  updateProfile: (id: string, input: BenefitProfileInput) =>
    send<BenefitProfile>('put', `/employees/${id}/profile`, input),

  files: (filter: YearFilter, signal?: AbortSignal) =>
    get<BenefitFileRow[]>('/files', filter, signal),
}

export const benefitKeys = {
  all: ['benefits'] as const,
  summary: () => [...benefitKeys.all, 'summary'] as const,
  lookups: () => [...benefitKeys.all, 'lookups'] as const,
  list: (name: string, params: object = {}) => [...benefitKeys.all, name, compact(params)] as const,
  detail: (name: string, id: string) => [...benefitKeys.all, name, 'detail', id] as const,
}

export const benefitsSummaryQueryOptions = () =>
  queryOptions({
    queryKey: benefitKeys.summary(),
    queryFn: ({ signal }) => benefitsApi.summary(signal),
  })

export const benefitsLookupsQueryOptions = () =>
  queryOptions({
    queryKey: benefitKeys.lookups(),
    queryFn: ({ signal }) => benefitsApi.lookups(signal),
    staleTime: 30_000,
  })

/** A list for a plan year filter; `fetch` is the matching `benefitsApi` call. */
export const benefitListQueryOptions = <TRow, TFilter extends object>(
  name: string,
  filter: TFilter,
  fetch: (filter: TFilter, signal?: AbortSignal) => Promise<TRow[]>,
) =>
  queryOptions({
    queryKey: benefitKeys.list(name, filter),
    queryFn: ({ signal }) => fetch(filter, signal),
    placeholderData: keepPreviousData,
  })
