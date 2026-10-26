import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  candidatesQueryOptions,
  enrollmentsQueryOptions,
  rosterApi,
  rosterKeys,
} from '../api/roster.api'
import type {
  EnrollmentInput,
  EnrollmentListParams,
  RosterEnrollmentRow,
} from '../types/roster.types'

/** One page of a group's enrolments (Active or Discontinued tab). */
export function useRosterEnrollments(groupId: string, params: EnrollmentListParams) {
  return useQuery(enrollmentsQueryOptions(groupId, params))
}

/**
 * People the signed-in user may enrol, searched on the server by name or code (the caller
 * debounces `search`), a page at a time: `rows` holds every page read, `loadMore` the next.
 */
export function useEnrollmentCandidates(search: string) {
  const query = useInfiniteQuery(candidatesQueryOptions(search))
  return {
    rows: query.data?.pages.flatMap((page) => page.data) ?? [],
    total: query.data?.pages[0]?.meta.total ?? 0,
    hasMore: query.hasNextPage,
    loadMore: () => {
      void query.fetchNextPage()
    },
    isPending: query.isPending,
    isFetching: query.isFetching,
    isFetchingMore: query.isFetchingNextPage,
    isError: query.isError,
  }
}

/**
 * Enrolment changes alter every group's "Employee Enrolled" count, so they refresh all
 * roster queries.
 */
function useInvalidateRoster() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: rosterKeys.all })
}

/** Key of the enroll mutation, so the dialog footer can show it is saving. */
export const enrollMutationKey = (groupId: string) =>
  [...rosterKeys.enrollments(groupId), 'enroll'] as const

export function useEnrollEmployees(groupId: string) {
  const invalidate = useInvalidateRoster()
  return useMutation({
    mutationKey: enrollMutationKey(groupId),
    mutationFn: (input: EnrollmentInput) => rosterApi.enroll(groupId, input),
    // The form shows "already on a roster" (409 ENROLMENT_OVERLAP) next to the employees.
    meta: { suppressErrorToast: true },
    onSuccess: async (created) => {
      toast.success(
        created.length === 1
          ? `${created[0]?.employeeName ?? 'Employee'} enrolled`
          : `${created.length} employees enrolled`,
      )
      await invalidate()
    },
  })
}

export function useDiscontinueEnrollment() {
  const invalidate = useInvalidateRoster()
  return useMutation({
    mutationFn: (enrollment: RosterEnrollmentRow) => rosterApi.discontinue(enrollment),
    onSuccess: async (enrollment) => {
      toast.success(`${enrollment.employeeName} moved to Discontinued`)
      await invalidate()
    },
  })
}

export function useDeleteEnrollment() {
  const invalidate = useInvalidateRoster()
  return useMutation({
    mutationFn: (enrollment: RosterEnrollmentRow) => rosterApi.removeEnrollment(enrollment),
    onSuccess: async (_data, enrollment) => {
      toast.success(`${enrollment.employeeName} removed from this roster`)
      await invalidate()
    },
  })
}
