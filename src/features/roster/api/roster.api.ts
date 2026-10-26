import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query'

import { EMPLOYEE_LOOKUP_PAGE_SIZE, fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem, PageParams, Paginated } from '@/types/api'

import type {
  EnrollmentCandidate,
  EnrollmentInput,
  EnrollmentListParams,
  RosterEnrollment,
  RosterGroupDetail,
  RosterGroupInput,
  RosterGroupRow,
  TimeSlotOption,
} from '../types/roster.types'

const GROUPS = '/roster/groups'
const ENROLMENTS = '/roster/enrolments'

export interface RosterListParams extends PageParams {
  search?: string
  isActive?: boolean
}

/** Leaves out empty values so `{ q: '' }` and `{}` share one cache entry. */
function compact<T extends object>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as T
}

/** REST calls for roster groups (`/api/roster/groups`) and enrolments (`/api/roster/enrolments`). */
export const rosterApi = {
  async list(params: RosterListParams, signal?: AbortSignal) {
    const { search, ...rest } = params
    const { data } = await apiClient.get<Paginated<RosterGroupRow>>(GROUPS, {
      params: compact({ ...rest, q: search }),
      signal,
    })
    return data
  },
  async get(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<RosterGroupDetail>>(`${GROUPS}/${id}`, { signal })
    return data.data
  },
  async create(input: RosterGroupInput) {
    const { data } = await apiClient.post<ApiItem<RosterGroupDetail>>(GROUPS, input)
    return data.data
  },
  async update(id: string, input: RosterGroupInput) {
    const { data } = await apiClient.put<ApiItem<RosterGroupDetail>>(`${GROUPS}/${id}`, input)
    return data.data
  },
  /**
   * The list's Status switch. The API has no status endpoint: the group is read and saved
   * whole with `isActive` changed (PUT needs the days and the row version).
   */
  async setStatus(id: string, isActive: boolean) {
    const group = await rosterApi.get(id)
    return rosterApi.update(id, {
      title: group.title,
      fromDate: group.fromDate,
      toDate: group.toDate,
      description: group.description,
      isActive,
      days: group.days.map((day) => ({
        weekday: day.weekday,
        isDayOff: day.isDayOff,
        timeSlotId: day.isDayOff ? null : day.timeSlotId,
      })),
      rowVersion: group.rowVersion,
    })
  },
  async remove(id: string, rowVersion: string) {
    await apiClient.delete(`${GROUPS}/${id}`, { params: { rowVersion } })
  },

  async enrollments(groupId: string, params: EnrollmentListParams, signal?: AbortSignal) {
    const { search, ...rest } = params
    const { data } = await apiClient.get<Paginated<RosterEnrollment>>(
      `${GROUPS}/${groupId}/enrolments`,
      { params: compact({ ...rest, q: search }), signal },
    )
    return data
  },
  /**
   * One page of the people the caller may enrol (`GET /employees/lookup`, scoped by the enrol
   * permission): `q` searches code and name on the server, `page`/`pageSize` (≤ 100) page it.
   */
  candidates(
    search: string,
    signal?: AbortSignal,
    page = 1,
    pageSize = EMPLOYEE_LOOKUP_PAGE_SIZE,
  ): Promise<Paginated<EnrollmentCandidate>> {
    return fetchEmployeeLookup<EnrollmentCandidate>(
      {
        permission: 'roster.enrolments.enroll',
        q: search.trim(),
        page,
        pageSize,
      },
      signal,
    )
  },
  async enroll(groupId: string, input: EnrollmentInput) {
    const { data } = await apiClient.post<{ data: RosterEnrollment[] }>(
      `${GROUPS}/${groupId}/enrolments`,
      input,
    )
    return data.data
  },
  /** Ends the enrolment on `endDate` (today when null). */
  async discontinue(enrollment: RosterEnrollment, endDate: string | null = null) {
    const { data } = await apiClient.patch<ApiItem<RosterEnrollment>>(
      `${ENROLMENTS}/${enrollment.id}/discontinue`,
      { endDate, rowVersion: enrollment.rowVersion },
    )
    return data.data
  },
  async updateEnrollment(
    enrollment: RosterEnrollment,
    dates: { startDate: string; endDate: string | null },
  ) {
    const { data } = await apiClient.put<ApiItem<RosterEnrollment>>(
      `${ENROLMENTS}/${enrollment.id}`,
      { ...dates, rowVersion: enrollment.rowVersion },
    )
    return data.data
  },
  async removeEnrollment(enrollment: RosterEnrollment) {
    await apiClient.delete(`${ENROLMENTS}/${enrollment.id}`, {
      params: { rowVersion: enrollment.rowVersion },
    })
  },

  /** Time slots for the week's pickers (Scheduling's planner options). */
  async timeSlotOptions(signal?: AbortSignal) {
    const { data } = await apiClient.get<{ data: TimeSlotOption[] }>(
      '/scheduling/options/time-slots',
      { signal },
    )
    return data.data
  },
}

/** Query-key factory: lists and details of groups, and each group's enrolments. */
export const rosterKeys = {
  all: ['roster-groups'] as const,
  lists: () => [...rosterKeys.all, 'list'] as const,
  list: (params: RosterListParams) => [...rosterKeys.lists(), compact(params)] as const,
  detail: (id: string) => [...rosterKeys.all, 'detail', id] as const,
  enrollments: (groupId: string) => [...rosterKeys.all, 'enrollments', groupId] as const,
  enrollmentList: (groupId: string, params: EnrollmentListParams) =>
    [...rosterKeys.enrollments(groupId), 'list', compact(params)] as const,
  candidates: (search: string) =>
    [...rosterKeys.all, 'candidates', search.trim().toLowerCase()] as const,
  /** Under Scheduling's key, so a change there refreshes it too. */
  timeSlotOptions: () => ['scheduling', 'options', 'time-slots'] as const,
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

/** The enrol picker's people for `search`, a page at a time ("Load more" reads the next). */
export function candidatesQueryOptions(search: string) {
  return infiniteQueryOptions({
    queryKey: rosterKeys.candidates(search),
    queryFn: ({ pageParam, signal }) => rosterApi.candidates(search, signal, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    placeholderData: keepPreviousData,
  })
}

export function timeSlotOptionsQueryOptions() {
  return queryOptions({
    queryKey: rosterKeys.timeSlotOptions(),
    queryFn: ({ signal }) => rosterApi.timeSlotOptions(signal),
    staleTime: 60_000,
  })
}
