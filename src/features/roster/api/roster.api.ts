import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type {
  EnrollmentCandidate,
  EnrollmentInput,
  EnrollmentListParams,
  RosterEnrollmentRow,
  RosterGroup,
  RosterGroupInput,
  RosterGroupRow,
} from '../types/roster.types'

const GROUPS = '/roster-groups'

export interface RosterListParams extends PageParams {
  search?: string
}

/** Leaves out empty values so `{ search: '' }` and `{}` share one cache entry. */
function compact<T extends object>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as T
}

/** REST calls for roster groups and their enrollments. */
export const rosterApi = {
  async list(params: RosterListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<RosterGroupRow>>(GROUPS, {
      params: compact(params),
      signal,
    })
    return data
  },
  async get(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<RosterGroup>>(`${GROUPS}/${id}`, { signal })
    return data.data
  },
  async create(input: RosterGroupInput) {
    const { data } = await apiClient.post<ApiItem<RosterGroup>>(GROUPS, input)
    return data.data
  },
  async update(id: string, input: RosterGroupInput) {
    const { data } = await apiClient.put<ApiItem<RosterGroup>>(`${GROUPS}/${id}`, input)
    return data.data
  },
  async setStatus(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<ApiItem<RosterGroupRow>>(`${GROUPS}/${id}/status`, {
      isActive,
    })
    return data.data
  },
  async remove(id: string) {
    await apiClient.delete(`${GROUPS}/${id}`)
  },

  async enrollments(groupId: string, params: EnrollmentListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<RosterEnrollmentRow>>(
      `${GROUPS}/${groupId}/enrollments`,
      { params: compact(params), signal },
    )
    return data
  },
  async candidates(groupId: string, search: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<EnrollmentCandidate[]>>(
      `${GROUPS}/${groupId}/candidates`,
      { params: compact({ search }), signal },
    )
    return data.data
  },
  async enroll(groupId: string, input: EnrollmentInput) {
    const { data } = await apiClient.post<ApiItem<RosterEnrollmentRow[]>>(
      `${GROUPS}/${groupId}/enrollments`,
      input,
    )
    return data.data
  },
  async discontinue(enrollmentId: string) {
    const { data } = await apiClient.post<ApiItem<RosterEnrollmentRow>>(
      `/roster-enrollments/${enrollmentId}/discontinue`,
    )
    return data.data
  },
}

/** Query-key factory: lists and details of groups, and each group's enrollments. */
export const rosterKeys = {
  all: ['roster-groups'] as const,
  lists: () => [...rosterKeys.all, 'list'] as const,
  list: (params: RosterListParams) => [...rosterKeys.lists(), compact(params)] as const,
  detail: (id: string) => [...rosterKeys.all, 'detail', id] as const,
  enrollments: (groupId: string) => [...rosterKeys.all, 'enrollments', groupId] as const,
  enrollmentList: (groupId: string, params: EnrollmentListParams) =>
    [...rosterKeys.enrollments(groupId), 'list', compact(params)] as const,
  candidates: (groupId: string, search: string) =>
    [...rosterKeys.enrollments(groupId), 'candidates', search.trim().toLowerCase()] as const,
}

export function rosterGroupsQueryOptions(params: RosterListParams) {
  return queryOptions({
    queryKey: rosterKeys.list(params),
    queryFn: ({ signal }) => rosterApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function rosterGroupQueryOptions(id: string) {
  return queryOptions({
    queryKey: rosterKeys.detail(id),
    queryFn: ({ signal }) => rosterApi.get(id, signal),
  })
}

export function enrollmentsQueryOptions(groupId: string, params: EnrollmentListParams) {
  return queryOptions({
    queryKey: rosterKeys.enrollmentList(groupId, params),
    queryFn: ({ signal }) => rosterApi.enrollments(groupId, params, signal),
    placeholderData: keepPreviousData,
  })
}

export function candidatesQueryOptions(groupId: string, search: string) {
  return queryOptions({
    queryKey: rosterKeys.candidates(groupId, search),
    queryFn: ({ signal }) => rosterApi.candidates(groupId, search, signal),
    placeholderData: keepPreviousData,
  })
}
