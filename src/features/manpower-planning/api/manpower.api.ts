import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchAllEmployeeLookup, fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  Budget,
  BudgetDuration,
  BudgetDurationInput,
  BudgetInput,
  DepartmentOption,
  EmployeeOption,
  EmployeePosition,
  EmployeePositionImportRow,
  EmployeePositionInput,
  ImportResult,
  JobDescription,
  ListParams,
  ManpowerLookups,
  NamedOption,
  OpenPosition,
  OpenPositionInput,
  Plan,
  PlanDetail,
  PlanInput,
  PositionTitle,
  SalaryRange,
  SalaryRangeInput,
} from '../types/manpower.types'

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/manpower${rest}`

async function getData<T>(url: string, signal?: AbortSignal, params?: object) {
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

/** Every page of a list (pickers): 100 a page, at most 20 pages. */
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

export type PageQuery<F> = ListParams & F

/** "Search here…" on the simple lists. */
export interface SearchFilters {
  q?: string | undefined
}

export interface PlanFilters extends SearchFilters {
  budgetDurationId?: string | undefined
  mode?: string | undefined
  status?: string | undefined
  isCurrent?: boolean | undefined
}

export interface BudgetFilters extends SearchFilters {
  budgetDurationId?: string | undefined
  status?: string | undefined
}

export interface EmployeePositionFilters extends SearchFilters {
  jobTitleId?: string | undefined
  branchId?: string | undefined
  divisionId?: string | undefined
  departmentId?: string | undefined
  employeeGroupId?: string | undefined
  status?: string | undefined
}

/**
 * `GET /employees/lookup`: the people the caller reaches through a manpower code, searched on
 * the server (`q`: code or name) and paged (`page`, `pageSize` up to 100).
 */
export interface EmployeeLookupParams {
  permission: string
  q?: string | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  page?: number | undefined
  /** 1–100 (default 50). */
  pageSize?: number | undefined
}

/**
 * A picker list the user may not read (E-Budgeting without the positions screen…) is empty
 * rather than failing the whole form.
 */
async function orEmptyIfForbidden<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return []
    throw error
  }
}

const orgLookup = (kind: string, signal?: AbortSignal) =>
  getData<{ id: string; name: string; parentId?: string | null }[]>(
    `/organisation/lookups/${kind}`,
    signal,
  )

const named = (rows: { id: string; name: string }[]): NamedOption[] =>
  rows.map((row) => ({ id: row.id, name: row.name }))

export const manpowerApi = {
  /** Organisation's lists, the budget durations and the employee positions, for the forms. */
  lookups: async (signal?: AbortSignal): Promise<ManpowerLookups> => {
    const [
      divisions,
      stations,
      departments,
      employeeGroups,
      grades,
      costCenters,
      jobTitles,
      durations,
      positions,
    ] = await Promise.all([
      orgLookup('divisions', signal),
      orgLookup('branches', signal),
      orgLookup('departments', signal),
      orgLookup('employee-groups', signal),
      orgLookup('grades', signal),
      orgLookup('cost-centers', signal),
      orgLookup('job-titles', signal),
      orEmptyIfForbidden(getAll<BudgetDuration>(path('/budget-durations'), {}, signal)),
      orEmptyIfForbidden(getAll<EmployeePosition>(path('/positions'), {}, signal)),
    ])
    return {
      divisions: named(divisions),
      stations: named(stations),
      departments: departments.map((row): DepartmentOption => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId ?? null,
      })),
      employeeGroups: named(employeeGroups),
      grades: named(grades),
      costCenters: named(costCenters),
      jobTitles: named(jobTitles),
      durations,
      positions,
    }
  },

  /** One page of `GET /employees/lookup` → `{data, meta}` (the pickers search it themselves). */
  employees: (params: EmployeeLookupParams, signal?: AbortSignal) =>
    fetchEmployeeLookup<EmployeeOption>(params, signal),
  /** Everyone `GET /employees/lookup` gives, every page (Import Existing Employees, HR contacts). */
  allEmployees: (params: Omit<EmployeeLookupParams, 'page' | 'pageSize'>, signal?: AbortSignal) =>
    fetchAllEmployeeLookup<EmployeeOption>(params, signal),

  // Planning
  plans: (params: PageQuery<PlanFilters>, signal?: AbortSignal) =>
    getPage<Plan>(path('/plans'), params, signal),
  plan: (id: string, signal?: AbortSignal) => getData<PlanDetail>(path(`/plans/${id}`), signal),
  createPlan: (input: PlanInput) => send<PlanDetail>('post', path('/plans'), input),
  updatePlan: (id: string, input: PlanInput) =>
    send<PlanDetail>('put', path(`/plans/${id}`), input),
  deletePlan: (plan: { id: string; rowVersion: string }) =>
    remove(path(`/plans/${plan.id}`), plan.rowVersion),

  // E-Budgeting and Budget Approvals
  budgets: (params: PageQuery<BudgetFilters>, signal?: AbortSignal) =>
    getPage<Budget>(path('/budgets'), params, signal),
  /** Budget Approvals: `status` '' lists every decision, absent only the pending ones. */
  budgetApprovals: (params: PageQuery<BudgetFilters>, signal?: AbortSignal) =>
    apiClient
      .get<Paginated<Budget>>(path('/budget-approvals'), {
        // The empty status is sent on purpose: it asks for every status.
        params: { ...compact(params), status: params.status ?? 'pending' },
        signal,
      })
      .then((response) => response.data),
  createBudget: (input: BudgetInput) => send<Budget>('post', path('/budgets'), input),
  updateBudget: (id: string, input: BudgetInput) =>
    send<Budget>('put', path(`/budgets/${id}`), input),
  deleteBudget: (budget: { id: string; rowVersion: string }) =>
    remove(path(`/budgets/${budget.id}`), budget.rowVersion),
  decideBudget: (
    budget: { id: string; rowVersion: string },
    decision: 'approve' | 'reject',
    remarks?: string,
  ) =>
    send<Budget>('post', path(`/budgets/${budget.id}/${decision}`), {
      rowVersion: budget.rowVersion,
      remarks: remarks?.trim() ? remarks.trim() : null,
    }),

  // Open Positions
  openPositions: (params: PageQuery<SearchFilters & { status?: string }>, signal?: AbortSignal) =>
    getPage<OpenPosition>(path('/open-positions'), params, signal),
  updateOpenPosition: (id: string, input: OpenPositionInput) =>
    send<OpenPosition>('put', path(`/open-positions/${id}`), input),
  setOpenPositionClosed: (position: { id: string; rowVersion: string }, closed: boolean) =>
    send<OpenPosition>(
      'post',
      path(`/open-positions/${position.id}/${closed ? 'close' : 'reopen'}`),
      { rowVersion: position.rowVersion },
    ),
  jobDescription: (id: string) => getData<JobDescription>(path(`/open-positions/${id}/jd`)),

  // E-Budget Settings
  durations: (params: PageQuery<SearchFilters>, signal?: AbortSignal) =>
    getPage<BudgetDuration>(path('/budget-durations'), params, signal),
  createDuration: (input: BudgetDurationInput) =>
    send<BudgetDuration>('post', path('/budget-durations'), input),
  updateDuration: (id: string, input: BudgetDurationInput) =>
    send<BudgetDuration>('put', path(`/budget-durations/${id}`), input),
  deleteDuration: (duration: { id: string; rowVersion: string }) =>
    remove(path(`/budget-durations/${duration.id}`), duration.rowVersion),

  positionTitles: (params: PageQuery<SearchFilters>, signal?: AbortSignal) =>
    getPage<PositionTitle>(path('/position-titles'), params, signal),

  positions: (params: PageQuery<EmployeePositionFilters>, signal?: AbortSignal) =>
    getPage<EmployeePosition>(path('/positions'), params, signal),
  createPosition: (input: EmployeePositionInput) =>
    send<EmployeePosition>('post', path('/positions'), input),
  updatePosition: (id: string, input: EmployeePositionInput) =>
    send<EmployeePosition>('put', path(`/positions/${id}`), input),
  deletePosition: (position: { id: string; rowVersion: string }) =>
    remove(path(`/positions/${position.id}`), position.rowVersion),
  importPositions: (rows: EmployeePositionImportRow[]) =>
    send<ImportResult>('post', path('/positions/import'), { rows }),
  salaryRanges: (positionId: string, signal?: AbortSignal) =>
    getData<SalaryRange[]>(path(`/positions/${positionId}/salary-ranges`), signal),
  addSalaryRange: (positionId: string, input: SalaryRangeInput) =>
    send<SalaryRange[]>('post', path(`/positions/${positionId}/salary-ranges`), input),
}

export const manpowerKeys = {
  all: ['manpower-planning'] as const,
  lookups: () => [...manpowerKeys.all, 'lookups'] as const,
  employees: (params: object) => [...manpowerKeys.all, 'employees', compact(params)] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...manpowerKeys.all, name, compact(params)] as const)
      : ([...manpowerKeys.all, name] as const),
  detail: (name: string, id: string) => [...manpowerKeys.all, name, 'detail', id] as const,
}

export const manpowerLookupsQueryOptions = () =>
  queryOptions({
    queryKey: manpowerKeys.lookups(),
    queryFn: ({ signal }) => manpowerApi.lookups(signal),
    staleTime: 30_000,
  })

/** A paginated list; `fetch` is the matching `manpowerApi` call. */
export const manpowerListQueryOptions = <TRow, TParams extends object>(
  name: string,
  params: TParams,
  fetch: (params: TParams, signal?: AbortSignal) => Promise<Paginated<TRow>>,
) =>
  queryOptions({
    queryKey: manpowerKeys.list(name, params),
    queryFn: ({ signal }) => fetch(params, signal),
    placeholderData: keepPreviousData,
  })
