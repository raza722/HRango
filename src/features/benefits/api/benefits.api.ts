import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchAllEmployeeLookup } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  BenefitEmployee,
  BenefitFile,
  BenefitPlan,
  BenefitsLookups,
  BenefitsSummary,
  EnrollmentWindow,
  EnrollmentWindowInput,
  LookupEmployee,
  PlanInput,
  PlanYear,
  PlanYearInput,
  ProfileChanges,
} from '../types/benefits.types'

const path = (rest: string) => `/benefits${rest}`

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function get<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(url, {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(url, { params: compact(params), signal })
  return data
}

/** Every page of a list: 100 a page, at most 20 pages (the tabs list without a pager). */
async function getAll<T>(url: string, params: object = {}, signal?: AbortSignal) {
  const rows: T[] = []
  for (let page = 1; page <= 20; page += 1) {
    const result = await getPage<T>(url, { ...params, page, pageSize: 100 }, signal)
    rows.push(...result.data)
    if (page >= result.meta.totalPages) break
  }
  return rows
}

async function send<T>(method: 'post' | 'put', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(url, body ?? {})
  return data.data
}

/** Deletes send the rowVersion last read. */
async function remove(url: string, rowVersion: string) {
  await apiClient.delete(url, { params: { rowVersion } })
}

interface Versioned {
  id: string
  rowVersion: string
}

/** The "Showing:" plan year (none: All Plan Years). */
export interface YearFilter {
  year?: string | undefined
}

export interface EmployeeFilter extends YearFilter {
  missing?: boolean | undefined
  q?: string | undefined
  page: number
  pageSize: number
}

/** A `GET /employees/lookup` row as the Benefits screens show a person. */
export const toLookupEmployee = (person: {
  id: string
  name: string
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
}): LookupEmployee => ({
  id: person.id,
  name: person.name,
  jobTitle: person.jobTitleName ?? '',
  departmentId: person.departmentId,
  department: person.departmentName ?? '',
})

/** A picker list the user may not read is empty rather than failing the pickers. */
async function orEmptyIfForbidden<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return []
    throw error
  }
}

/** The permission the enrollment window's people picker reads with. */
export const PEOPLE_PERMISSION = 'benefits.enrollment_windows.create'

export const benefitsApi = {
  summary: (signal?: AbortSignal) => get<BenefitsSummary>(path('/summary'), undefined, signal),

  /**
   * Plan years, plans and people. The people are everyone `GET /employees/lookup` gives (every
   * page): they name the chosen people, list the departments and the HR contacts. The
   * enrollment window's people picker searches the lookup itself (`q`, paged).
   */
  lookups: async (signal?: AbortSignal): Promise<BenefitsLookups> => {
    const [planYears, plans, people] = await Promise.all([
      orEmptyIfForbidden(getAll<PlanYear>(path('/plan-years'), {}, signal)),
      orEmptyIfForbidden(getAll<BenefitPlan>(path('/plans'), {}, signal)),
      fetchAllEmployeeLookup({ permission: PEOPLE_PERMISSION }, signal),
    ])
    const employees = people.map(toLookupEmployee)
    const departments = new Map<string, string>()
    for (const person of employees) {
      if (person.departmentId && person.department) {
        departments.set(person.departmentId, person.department)
      }
    }
    return {
      planYears,
      plans,
      employees,
      departments: [...departments]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  },

  /** The plan years; the "Showing:" year keeps only that one. */
  planYears: async (filter: YearFilter, signal?: AbortSignal) => {
    const rows = await getAll<PlanYear>(path('/plan-years'), {}, signal)
    return filter.year ? rows.filter((row) => row.id === filter.year) : rows
  },
  planYear: (id: string, signal?: AbortSignal) =>
    get<PlanYear>(path(`/plan-years/${id}`), undefined, signal),
  createPlanYear: (input: PlanYearInput) => send<PlanYear>('post', path('/plan-years'), input),
  updatePlanYear: (id: string, input: PlanYearInput) =>
    send<PlanYear>('put', path(`/plan-years/${id}`), input),
  deletePlanYear: (year: Versioned) => remove(path(`/plan-years/${year.id}`), year.rowVersion),

  plans: (filter: YearFilter, signal?: AbortSignal) =>
    getAll<BenefitPlan>(path('/plans'), { planYearId: filter.year }, signal),
  createPlan: (input: PlanInput) => send<BenefitPlan>('post', path('/plans'), input),
  duplicatePlan: (id: string) => send<BenefitPlan>('post', path(`/plans/${id}/duplicate`)),
  deletePlan: (plan: Versioned) => remove(path(`/plans/${plan.id}`), plan.rowVersion),
  /** Attaches an upload (`POST /files`, module benefits) to a plan. */
  addPlanFile: (planId: string, fileId: string) =>
    send<BenefitFile>('post', path(`/plans/${planId}/files`), { fileId }),

  enrollmentWindows: (filter: YearFilter, signal?: AbortSignal) =>
    getAll<EnrollmentWindow>(path('/enrollment-windows'), { planYearId: filter.year }, signal),
  createEnrollmentWindow: (input: EnrollmentWindowInput) =>
    send<EnrollmentWindow>('post', path('/enrollment-windows'), input),
  deleteEnrollmentWindow: (window: Versioned) =>
    remove(path(`/enrollment-windows/${window.id}`), window.rowVersion),

  employees: (filter: EmployeeFilter, signal?: AbortSignal) =>
    getPage<BenefitEmployee>(
      path('/employees'),
      {
        planYearId: filter.year,
        missingOnly: filter.missing ? 'true' : undefined,
        q: filter.q,
        page: filter.page,
        pageSize: filter.pageSize,
      },
      signal,
    ),
  /** Update Information: asks HR to change the person's details (Employees module). */
  requestProfileUpdate: (employeeId: string, changes: ProfileChanges) =>
    send<{ id: string; status: string }>('post', `/employees/${employeeId}/update-requests`, {
      changes,
    }),

  files: (filter: YearFilter, signal?: AbortSignal) =>
    getAll<BenefitFile>(path('/files'), { planYearId: filter.year }, signal),
  deleteFile: (file: Versioned) => remove(path(`/files/${file.id}`), file.rowVersion),
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
export const benefitListQueryOptions = <TResult, TFilter extends object>(
  name: string,
  filter: TFilter,
  fetch: (filter: TFilter, signal?: AbortSignal) => Promise<TResult>,
) =>
  queryOptions({
    queryKey: benefitKeys.list(name, filter),
    queryFn: ({ signal }) => fetch(filter, signal),
    placeholderData: keepPreviousData,
  })
