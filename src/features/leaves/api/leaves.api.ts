import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  LeaveApplication,
  LeaveApplicationDetail,
  LeaveApplicationListParams,
  LeaveApplicationPage,
  LeaveApplyInput,
  LeaveDecisionInput,
  LeavePolicy,
  LeavePolicyInput,
  LeaveSettings,
  LeavesLookups,
  LeaveType,
  LeaveTypeInput,
  LeaveTypeListParams,
} from '../types/leaves.types'

/** Flattens the filters into the query and leaves out empty values. */
function query(params: object & { filters?: Record<string, string | undefined> | undefined }) {
  const { filters, ...rest } = params
  return Object.fromEntries(
    Object.entries({ ...rest, ...filters }).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  )
}

const path = (suffix = '') => `/leaves${suffix}`

export const leavesApi = {
  async lookups(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeavesLookups>>(path('/lookups'), { signal })
    return data.data
  },
  async applications(params: LeaveApplicationListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<LeaveApplicationPage>(path('/applications'), {
      params: query(params),
      signal,
    })
    return data
  },
  async application(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveApplicationDetail>>(
      path(`/applications/${id}`),
      { signal },
    )
    return data.data
  },
  async apply(input: LeaveApplyInput) {
    const { data } = await apiClient.post<ApiItem<LeaveApplication>>(path('/applications'), input)
    return data.data
  },
  async decide(id: string, input: LeaveDecisionInput) {
    const { data } = await apiClient.post<ApiItem<LeaveApplication>>(
      path(`/applications/${id}/decision`),
      input,
    )
    return data.data
  },
  async cancel(id: string, reason: string) {
    const { data } = await apiClient.post<ApiItem<LeaveApplication>>(
      path(`/applications/${id}/cancel`),
      { reason },
    )
    return data.data
  },

  async settings(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveSettings>>(path('/settings'), { signal })
    return data.data
  },
  async saveSettings(input: LeaveSettings) {
    const { data } = await apiClient.put<ApiItem<LeaveSettings>>(path('/settings'), input)
    return data.data
  },

  async types(params: LeaveTypeListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeaveType>>(path('/types'), {
      params: query(params),
      signal,
    })
    return data
  },
  async createType(input: LeaveTypeInput) {
    const { data } = await apiClient.post<ApiItem<LeaveType>>(path('/types'), input)
    return data.data
  },
  async updateType(id: string, input: LeaveTypeInput) {
    const { data } = await apiClient.put<ApiItem<LeaveType>>(path(`/types/${id}`), input)
    return data.data
  },
  async deleteType(id: string) {
    await apiClient.delete(path(`/types/${id}`))
  },

  async policies(params: { page: number; pageSize: number }, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeavePolicy>>(path('/policies'), {
      params,
      signal,
    })
    return data
  },
  async createPolicy(input: LeavePolicyInput) {
    const { data } = await apiClient.post<ApiItem<LeavePolicy>>(path('/policies'), input)
    return data.data
  },
  async updatePolicy(id: string, input: LeavePolicyInput) {
    const { data } = await apiClient.put<ApiItem<LeavePolicy>>(path(`/policies/${id}`), input)
    return data.data
  },
  async deletePolicy(id: string) {
    await apiClient.delete(path(`/policies/${id}`))
  },
  async enroll(id: string, employeeIds: string[]) {
    const { data } = await apiClient.put<ApiItem<LeavePolicy>>(
      path(`/policies/${id}/enrollments`),
      { employeeIds },
    )
    return data.data
  },
}

export const leavesKeys = {
  all: ['leaves'] as const,
  lookups: () => [...leavesKeys.all, 'lookups'] as const,
  applications: () => [...leavesKeys.all, 'applications'] as const,
  applicationList: (params: LeaveApplicationListParams) =>
    [...leavesKeys.applications(), 'list', query(params)] as const,
  application: (id: string) => [...leavesKeys.applications(), 'detail', id] as const,
  settings: () => [...leavesKeys.all, 'settings'] as const,
  types: () => [...leavesKeys.all, 'types'] as const,
  typeList: (params: LeaveTypeListParams) => [...leavesKeys.types(), query(params)] as const,
  policies: () => [...leavesKeys.all, 'policies'] as const,
  policyList: (params: { page: number; pageSize: number }) =>
    [...leavesKeys.policies(), params] as const,
}

export const leavesLookupsQueryOptions = () =>
  queryOptions({
    queryKey: leavesKeys.lookups(),
    queryFn: ({ signal }) => leavesApi.lookups(signal),
    staleTime: 60_000,
  })

export const leaveApplicationsQueryOptions = (params: LeaveApplicationListParams) =>
  queryOptions({
    queryKey: leavesKeys.applicationList(params),
    queryFn: ({ signal }) => leavesApi.applications(params, signal),
    placeholderData: keepPreviousData,
  })

export const leaveApplicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: leavesKeys.application(id),
    queryFn: ({ signal }) => leavesApi.application(id, signal),
  })

export const leaveSettingsQueryOptions = () =>
  queryOptions({
    queryKey: leavesKeys.settings(),
    queryFn: ({ signal }) => leavesApi.settings(signal),
  })

export const leaveTypesQueryOptions = (params: LeaveTypeListParams) =>
  queryOptions({
    queryKey: leavesKeys.typeList(params),
    queryFn: ({ signal }) => leavesApi.types(params, signal),
    placeholderData: keepPreviousData,
  })

export const leavePoliciesQueryOptions = (params: { page: number; pageSize: number }) =>
  queryOptions({
    queryKey: leavesKeys.policyList(params),
    queryFn: ({ signal }) => leavesApi.policies(params, signal),
    placeholderData: keepPreviousData,
  })
