import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** One page of a group's enrollments (Active or Discontinued tab). */
export function useRosterEnrollments(groupId: string, params: EnrollmentListParams) {
  return useQuery(enrollmentsQueryOptions(groupId, params))
}

/** People who could be enrolled, with the roster each is on now. */
export function useEnrollmentCandidates(groupId: string, search: string) {
  return useQuery(candidatesQueryOptions(groupId, search))
}

/**
 * Enrollment changes alter every group's "Employee Enrolled" count and the
 * candidates' current roster, so they refresh all roster queries.
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
    // The form shows "already on a roster" next to the employee list.
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
    mutationFn: (enrollment: RosterEnrollmentRow) => rosterApi.discontinue(enrollment.id),
    onSuccess: async (enrollment) => {
      toast.success(`${enrollment.employeeName} moved to Discontinued`)
      await invalidate()
    },
  })
}
