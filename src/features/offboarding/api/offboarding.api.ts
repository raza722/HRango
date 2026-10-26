import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  ActiveChecklistField,
  ChecklistAnswersInput,
  ChecklistInput,
  EndOfEmployment,
  EndOfEmploymentInput,
  EndOfEmploymentRow,
  OffboardingChecklist,
} from '../types/offboarding.types'

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/offboarding${rest}`

async function getData<T>(url: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), { signal })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string, rowVersion: string) {
  await apiClient.delete(path(url), { params: { rowVersion } })
}

export interface ListParams {
  page: number
  pageSize: number
}

export type PageQuery<F> = ListParams & F

export interface EoeFilters {
  q?: string | undefined
  /** pending / completed; the sidebar scope, or the Status filter on All. */
  status?: string | undefined
  employeeId?: string | undefined
  departmentId?: string | undefined
  branchId?: string | undefined
  locationId?: string | undefined
  designationId?: string | undefined
  serveNotice?: boolean | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface ChecklistFilters {
  q?: string | undefined
  isActive?: boolean | undefined
}

/** A record and the rowVersion it was read with. */
export interface Versioned {
  id: string
  rowVersion: string
}

export const offboardingApi = {
  // End of Employment
  endOfEmployments: (params: PageQuery<EoeFilters>, signal?: AbortSignal) =>
    getPage<EndOfEmploymentRow>('/end-of-employment', params, signal),
  endOfEmployment: (id: string, signal?: AbortSignal) =>
    getData<EndOfEmployment>(`/end-of-employment/${id}`, signal),
  /** Fields of the active checklists: what the Checklist tab asks. */
  checklistFields: (signal?: AbortSignal) =>
    getData<ActiveChecklistField[]>('/end-of-employment/checklist-fields', signal),
  createEndOfEmployment: (input: EndOfEmploymentInput) =>
    send<EndOfEmployment>('post', '/end-of-employment', input),
  updateEndOfEmployment: (id: string, input: EndOfEmploymentInput) =>
    send<EndOfEmployment>('put', `/end-of-employment/${id}`, input),
  saveChecklistAnswers: (id: string, input: ChecklistAnswersInput) =>
    send<EndOfEmployment>('put', `/end-of-employment/${id}/checklist`, input),
  /** Completes it now; 409 names what it still waits for. */
  completeEndOfEmployment: ({ id, rowVersion }: Versioned) =>
    send<EndOfEmployment>('patch', `/end-of-employment/${id}/complete`, { rowVersion }),
  rehire: ({ id, rowVersion }: Versioned, joiningDate: string) =>
    send<EndOfEmployment>('patch', `/end-of-employment/${id}/rehire`, { joiningDate, rowVersion }),
  deleteEndOfEmployment: ({ id, rowVersion }: Versioned) =>
    remove(`/end-of-employment/${id}`, rowVersion),

  // Settings → Off Boarding Checklist
  checklists: (params: PageQuery<ChecklistFilters>, signal?: AbortSignal) =>
    getPage<OffboardingChecklist>('/settings/checklists', params, signal),
  checklist: (id: string, signal?: AbortSignal) =>
    getData<OffboardingChecklist>(`/settings/checklists/${id}`, signal),
  createChecklist: (input: ChecklistInput) =>
    send<OffboardingChecklist>('post', '/settings/checklists', input),
  updateChecklist: (id: string, input: ChecklistInput) =>
    send<OffboardingChecklist>('put', `/settings/checklists/${id}`, input),
  deleteChecklist: ({ id, rowVersion }: Versioned) =>
    remove(`/settings/checklists/${id}`, rowVersion),
}

export const offboardingKeys = {
  all: ['offboarding'] as const,
  checklistFields: () => [...offboardingKeys.all, 'checklist-fields'] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...offboardingKeys.all, name, compact(params)] as const)
      : ([...offboardingKeys.all, name] as const),
  detail: (name: string, id: string) => [...offboardingKeys.all, name, 'detail', id] as const,
}

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
