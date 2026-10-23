import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  BudgetDuration,
  BudgetDurationInput,
  BudgetInput,
  BudgetRow,
  EmployeePositionImportRow,
  EmployeePositionInput,
  EmployeePositionRow,
  ImportResult,
  JobDescription,
  ListParams,
  ManpowerLookups,
  OpenPosition,
  OpenPositionInput,
  PlanDetail,
  PlanInput,
  PlanRow,
  PositionTitle,
  PositionTitleInput,
} from '../types/manpower.types'

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/manpower-planning${rest}`

async function getData<T>(url: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), { signal })
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

/** "Search here…" on the simple lists. */
export interface SearchFilters {
  search?: string | undefined
}

export interface PlanFilters {
  title?: string | undefined
  year?: string | undefined
  mode?: string | undefined
  status?: string | undefined
  durationId?: string | undefined
}

export interface PositionTitleFilters extends SearchFilters {
  title?: string | undefined
  status?: string | undefined
}

export interface EmployeePositionFilters {
  code?: string | undefined
  divisionId?: string | undefined
  stationId?: string | undefined
  departmentId?: string | undefined
  subDepartmentId?: string | undefined
  employeeGroupId?: string | undefined
  costCenterId?: string | undefined
  positionTitleId?: string | undefined
  reportsToId?: string | undefined
  gradeId?: string | undefined
  status?: string | undefined
}

export const manpowerApi = {
  lookups: (signal?: AbortSignal) => getData<ManpowerLookups>('/lookups', signal),

  // Planning
  plans: (params: PageQuery<PlanFilters>, signal?: AbortSignal) =>
    getPage<PlanRow>('/plans', params, signal),
  plan: (id: string, signal?: AbortSignal) => getData<PlanDetail>(`/plans/${id}`, signal),
  createPlan: (input: PlanInput) => send<PlanDetail>('post', '/plans', input),
  updatePlan: (id: string, input: PlanInput) => send<PlanDetail>('put', `/plans/${id}`, input),
  deletePlan: (id: string) => remove(`/plans/${id}`),

  // E-Budgeting and Budget Approvals
  budgets: (params: PageQuery<SearchFilters>, signal?: AbortSignal) =>
    getPage<BudgetRow>('/budgets', params, signal),
  updateBudget: (id: string, input: BudgetInput) => send<BudgetRow>('put', `/budgets/${id}`, input),
  deleteBudget: (id: string) => remove(`/budgets/${id}`),
  decideBudget: (id: string, decision: 'approve' | 'reject') =>
    send<BudgetRow>('post', `/budgets/${id}/${decision}`),

  // Open Positions
  openPositions: (params: PageQuery<SearchFilters>, signal?: AbortSignal) =>
    getPage<OpenPosition>('/open-positions', params, signal),
  updateOpenPosition: (id: string, input: OpenPositionInput) =>
    send<OpenPosition>('put', `/open-positions/${id}`, input),
  setOpenPositionClosed: (id: string, closed: boolean) =>
    send<OpenPosition>('post', `/open-positions/${id}/${closed ? 'close' : 'reopen'}`),
  jobDescription: (id: string) => getData<JobDescription>(`/open-positions/${id}/jd`),

  // E-Budget Settings
  durations: (params: PageQuery<SearchFilters>, signal?: AbortSignal) =>
    getPage<BudgetDuration>('/durations', params, signal),
  createDuration: (input: BudgetDurationInput) => send<BudgetDuration>('post', '/durations', input),
  updateDuration: (id: string, input: BudgetDurationInput) =>
    send<BudgetDuration>('put', `/durations/${id}`, input),
  deleteDuration: (id: string) => remove(`/durations/${id}`),

  positionTitles: (params: PageQuery<PositionTitleFilters>, signal?: AbortSignal) =>
    getPage<PositionTitle>('/position-titles', params, signal),
  createPositionTitle: (input: PositionTitleInput) =>
    send<PositionTitle>('post', '/position-titles', input),
  updatePositionTitle: (id: string, input: PositionTitleInput) =>
    send<PositionTitle>('put', `/position-titles/${id}`, input),
  setPositionTitleActive: (id: string, active: boolean) =>
    send<PositionTitle>('post', `/position-titles/${id}/${active ? 'activate' : 'deactivate'}`),
  deletePositionTitle: (id: string) => remove(`/position-titles/${id}`),

  positions: (params: PageQuery<EmployeePositionFilters>, signal?: AbortSignal) =>
    getPage<EmployeePositionRow>('/positions', params, signal),
  createPosition: (input: EmployeePositionInput) =>
    send<EmployeePositionRow>('post', '/positions', input),
  updatePosition: (id: string, input: EmployeePositionInput) =>
    send<EmployeePositionRow>('put', `/positions/${id}`, input),
  setPositionActive: (id: string, active: boolean) =>
    send<EmployeePositionRow>('post', `/positions/${id}/${active ? 'activate' : 'deactivate'}`),
  deletePosition: (id: string) => remove(`/positions/${id}`),
  importPositions: (rows: EmployeePositionImportRow[]) =>
    send<ImportResult>('post', '/positions/import', { rows }),
}

export const manpowerKeys = {
  all: ['manpower-planning'] as const,
  lookups: () => [...manpowerKeys.all, 'lookups'] as const,
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
