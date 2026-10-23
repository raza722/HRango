import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  attendanceApi,
  attendanceKeys,
  attendanceLookupsQueryOptions,
  clockQueryOptions,
  dayQueryOptions,
  daysOverviewQueryOptions,
  historyQueryOptions,
  logsQueryOptions,
  overviewQueryOptions,
  timeSheetQueryOptions,
} from '../api/attendance.api'
import type {
  AbsenceInput,
  DayEditInput,
  DayKey,
  MissingPunchInput,
  OvertimeInput,
  OverviewParams,
  RelaxationInput,
  TimeSheetParams,
} from '../types/attendance.types'
import { formatClockTime } from '../utils/local-time'

export function useAttendanceOverview(params: OverviewParams) {
  return useQuery(overviewQueryOptions(params))
}

export function useTimeSheet(params: TimeSheetParams, enabled = true) {
  return useQuery({ ...timeSheetQueryOptions(params), enabled })
}

/** "Days Overview This Month" of a person (the signed-in one when undefined). */
export function useDaysOverview(employeeId: string | undefined, enabled = true) {
  return useQuery({ ...daysOverviewQueryOptions(employeeId), enabled })
}

export function useAttendanceLookups() {
  return useQuery(attendanceLookupsQueryOptions())
}

export function useClock() {
  return useQuery(clockQueryOptions())
}

export function useAttendanceDay(key: DayKey | null) {
  return useQuery({
    ...dayQueryOptions(key ?? { employeeId: '', date: '' }),
    enabled: key !== null,
  })
}

export function useDayHistory(key: DayKey, page: number) {
  return useQuery(historyQueryOptions(key, page))
}

export function useDayLogs(key: DayKey) {
  return useQuery(logsQueryOptions(key))
}

/**
 * A change to one day: on success every attendance list, the tiles and the
 * open day refetch, and a toast says what happened.
 */
function useDayMutation<TInput>(
  mutationFn: (key: DayKey, input: TInput) => Promise<unknown>,
  message: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, input }: { key: DayKey; input: TInput }) => mutationFn(key, input),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      toast.success(message)
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

export const useUpdateDay = () =>
  useDayMutation(
    (key, input: DayEditInput) => attendanceApi.updateDay(key, input),
    'Time sheet updated',
  )

export const useAddMissingPunch = () =>
  useDayMutation(
    (key, input: MissingPunchInput) => attendanceApi.addMissingPunch(key, input),
    'Missing punch added',
  )

export const useApplyRelaxation = () =>
  useDayMutation(
    (key, input: RelaxationInput) => attendanceApi.applyRelaxation(key, input),
    'Relaxation applied',
  )

export const useMarkAbsence = () =>
  useDayMutation(
    (key, input: AbsenceInput) => attendanceApi.markAbsence(key, input),
    'Absence updated',
  )

export const useApproveOvertime = () =>
  useDayMutation(
    (key, input: OvertimeInput) => attendanceApi.approveOvertime(key, input),
    'Overtime approved',
  )

export function useAddComment(key: DayKey) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => attendanceApi.addComment(key, text),
    meta: { errorMessage: 'Could not post the comment. Try again.' },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.day(key) })
    },
  })
}

export function useDeleteComment(key: DayKey) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => attendanceApi.deleteComment(key, commentId),
    meta: { successMessage: 'Comment deleted' },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.day(key) })
    },
  })
}

/** Clock In / Clock Out for the signed-in person. */
export function usePunchClock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => attendanceApi.punchClock(),
    meta: { errorMessage: 'Could not record the punch. Try again.' },
    onSuccess: async (state) => {
      const at = state.lastPunch ? formatClockTime(state.lastPunch.at) : ''
      toast.success(state.clockedIn ? `Clocked in at ${at}` : `Clocked out at ${at}`)
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
