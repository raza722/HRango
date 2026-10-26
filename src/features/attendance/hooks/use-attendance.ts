import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  attendanceApi,
  attendanceKeys,
  clockQueryOptions,
  dayQueryOptions,
  historyQueryOptions,
  overviewQueryOptions,
  summaryQueryOptions,
  timeSheetQueryOptions,
} from '../api/attendance.api'
import type {
  ClockInput,
  DayEditInput,
  DayKey,
  OverviewParams,
  ProcessInput,
  SummaryParams,
  TimeSheetParams,
} from '../types/attendance.types'
import { formatClockTime } from '../utils/local-time'

export function useAttendanceOverview(params: OverviewParams) {
  return useQuery(overviewQueryOptions(params))
}

export function useTimeSheet(params: TimeSheetParams, enabled = true) {
  return useQuery({ ...timeSheetQueryOptions(params), enabled })
}

/** "Days Overview This Month": the time-sheet summary of the scope (and person). */
export function useDaysOverview(params: SummaryParams, enabled = true) {
  return useQuery({ ...summaryQueryOptions(params), enabled })
}

export function useClock(enabled = true) {
  return useQuery({ ...clockQueryOptions(), enabled })
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

/** Saves the day edit; every attendance list, the tiles and the open day refetch. */
export function useUpdateDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, input }: { key: DayKey; input: DayEditInput }) =>
      attendanceApi.updateDay(key, input),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      toast.success('Time sheet updated')
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

/** "Process": works the time sheet out again for a date range (and people). */
export function useProcessTimeSheet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProcessInput) => attendanceApi.process(input),
    meta: { errorMessage: 'Could not process the time sheet. Try again.' },
    onSuccess: async (result) => {
      toast.success(
        `Processed ${result.processedDays} day${result.processedDays === 1 ? '' : 's'} for ${result.employees} employee${result.employees === 1 ? '' : 's'}`,
      )
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

/** Clock In / Clock Out for the signed-in person. */
export function usePunchClock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClockInput) => attendanceApi.punchClock(input),
    meta: { suppressErrorToast: true },
    onSuccess: async (punch) => {
      const at = formatClockTime(punch.punchedAt)
      toast.success(punch.punchType === 'check_in' ? `Clocked in at ${at}` : `Clocked out at ${at}`)
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
