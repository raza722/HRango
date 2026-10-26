import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  boardQueryOptions,
  employeesQueryOptions,
  geoFencesQueryOptions,
  optionsQueryOptions,
  orgLookupQueryOptions,
  scheduleQueryOptions,
  schedulingApi,
  schedulingKeys,
  yearQueryOptions,
} from '../api/scheduling.api'
import type {
  ActiveShift,
  BoardParams,
  BulkDeleteInput,
  BulkDeleteResult,
  BulkEditInput,
  DefaultShiftInput,
  EmployeeFilters,
  OrgLookupKind,
  RestDayRangeDeleteInput,
  RestDayRuleInput,
  ScheduleBatchInput,
  ScheduleBatchResult,
  ScheduleInput,
  SwapInput,
  YearParams,
} from '../types/scheduling.types'
import { toDay } from '../utils/schedule-dates'
import { clockOf } from '../utils/shift-hours'

export function useScheduleBoard(params: BoardParams, enabled = true) {
  return useQuery({ ...boardQueryOptions(params), enabled })
}

export function useScheduleYear(params: YearParams, enabled = true) {
  return useQuery({ ...yearQueryOptions(params), enabled })
}

/**
 * "Active Status": the signed-in person's shift today, read from the My board for today
 * (the API has no separate endpoint). A user with no employee record has none.
 */
export function useActiveShift() {
  const today = toDay(new Date())
  return useQuery({
    queryKey: schedulingKeys.activeShift(today),
    queryFn: async ({ signal }): Promise<ActiveShift> => {
      const page = await schedulingApi.board(
        { scope: 'my', from: today, to: today, page: 1, pageSize: 1 },
        signal,
      )
      const shift = page.data[0]?.shifts[0]
      return shift
        ? {
            slotName: shift.timeSlotName,
            clockIn: clockOf(shift.startAt),
            clockOut: clockOf(shift.endAt),
          }
        : { slotName: null, clockIn: null, clockOut: null }
    },
  })
}

export function useSchedule(id: string | undefined) {
  return useQuery({ ...scheduleQueryOptions(id ?? ''), enabled: id !== undefined })
}

export function useTimeSlotOptions() {
  return useQuery(optionsQueryOptions('time-slots'))
}

export function useBreakTypeOptions() {
  return useQuery(optionsQueryOptions('break-types'))
}

export function useRosterGroupOptions() {
  return useQuery(optionsQueryOptions('roster-groups'))
}

export function useGeoFences() {
  return useQuery(geoFencesQueryOptions())
}

export function useOrgLookup(kind: OrgLookupKind, enabled = true) {
  return useQuery({ ...orgLookupQueryOptions(kind), enabled })
}

/**
 * People `permission` reaches, searched on the server (`filters.search`, debounced by the
 * caller) and paged: `rows` holds every page read, `loadMore` reads the next.
 */
export function useEmployeeSearch(permission: string, filters: EmployeeFilters) {
  const query = useInfiniteQuery(employeesQueryOptions(permission, filters))
  return {
    rows: query.data?.pages.flatMap((page) => page.data) ?? [],
    total: query.data?.pages[0]?.meta.total ?? 0,
    hasMore: query.hasNextPage,
    loadMore: () => {
      void query.fetchNextPage()
    },
    isPending: query.isPending,
    isFetchingMore: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
  }
}

const plural = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`

/** "5 shifts added, 2 replaced, 1 rest day skipped" from a batch result. */
export function describeBatch(result: ScheduleBatchResult): string {
  const parts = [
    `${plural(result.createdCount, 'shift')} added`,
    result.replacedCount > 0 && `${result.replacedCount} replaced`,
    result.skippedRestDays > 0 && `${plural(result.skippedRestDays, 'rest day')} skipped`,
    result.skippedNoShift > 0 && `${plural(result.skippedNoShift, 'day')} without a shift`,
  ].filter(Boolean)
  return parts.join(', ')
}

/** "3 shifts and 1 rest day deleted". */
export function describeDelete(result: BulkDeleteResult): string {
  if (result.deletedSchedules === 0 && result.deletedRestDays === 0) {
    return 'There was nothing to delete in that range'
  }
  const parts = [
    result.deletedSchedules > 0 && plural(result.deletedSchedules, 'shift'),
    result.deletedRestDays > 0 && plural(result.deletedRestDays, 'rest day'),
  ].filter(Boolean)
  return `${parts.join(' and ')} deleted`
}

/**
 * A schedule change: on success the board, the "Active Status" box and any open shift
 * refetch, and a toast describes what happened. Forms that show the API's message
 * themselves (a 409 overlap they can resend) pass `suppressErrorToast`.
 */
function useScheduleMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: (result: TResult, input: TInput) => string,
  options: { suppressErrorToast?: boolean } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: options.suppressErrorToast ?? false },
    onSuccess: async (result, input) => {
      toast.success(success(result, input))
      await queryClient.invalidateQueries({ queryKey: schedulingKeys.all })
    },
  })
}

export const useCreateBatch = () =>
  useScheduleMutation(
    (input: ScheduleBatchInput) => schedulingApi.createBatch(input),
    (result) => `Schedule saved: ${describeBatch(result)}`,
    { suppressErrorToast: true },
  )

export const useApplyDefaultShift = () =>
  useScheduleMutation(
    (input: DefaultShiftInput) => schedulingApi.applyDefaultShift(input),
    (result) => `Default shift applied: ${describeBatch(result)}`,
    { suppressErrorToast: true },
  )

export const useBulkDelete = () =>
  useScheduleMutation(
    (input: BulkDeleteInput) => schedulingApi.bulkDelete(input),
    (result) => describeDelete(result),
  )

export const useCreateRestDays = () =>
  useScheduleMutation(
    (input: RestDayRuleInput) => schedulingApi.createRestDayRule(input),
    (rule) => `Rest days saved: ${plural(rule.restDayCount, 'rest day')} added`,
  )

export const useDeleteRestDays = () =>
  useScheduleMutation(
    (input: RestDayRangeDeleteInput) => schedulingApi.deleteRestDayRange(input),
    (result) => (result.deletedRestDays === 1 ? 'Rest day deleted' : describeDelete(result)),
  )

export const useCreateSchedule = () =>
  useScheduleMutation(
    (input: ScheduleInput) => schedulingApi.createSchedule(input),
    () => 'Shift added',
    { suppressErrorToast: true },
  )

export const useUpdateSchedule = () =>
  useScheduleMutation(
    ({ id, input }: { id: string; input: ScheduleInput }) =>
      schedulingApi.updateSchedule(id, input),
    () => 'Schedule updated',
    { suppressErrorToast: true },
  )

/** Moves a shift to another date for the same person (an edit that keeps everything else). */
export const useMoveSchedule = () =>
  useScheduleMutation(
    async ({ id, workDate }: { id: string; workDate: string }) => {
      const shift = await schedulingApi.schedule(id)
      return schedulingApi.updateSchedule(id, {
        workDate,
        timeSlotId: shift.timeSlotId,
        startTime: clockOf(shift.startAt),
        endTime: clockOf(shift.endAt),
        geoFenceId: shift.geoFenceId,
        isWfh: shift.isWfh,
        breaks: shift.breaks.map((item) => ({
          breakTypeId: item.breakTypeId,
          startTime: clockOf(item.startAt) ?? '00:00',
          endTime: clockOf(item.endAt) ?? '00:00',
          isInclusive: item.isInclusive,
        })),
        rowVersion: shift.rowVersion,
      })
    },
    () => 'Shift moved',
  )

export const useBulkEdit = () =>
  useScheduleMutation(
    (input: BulkEditInput) => schedulingApi.bulkEdit(input),
    (result) => `${plural(result.updatedSchedules, 'shift')} updated`,
  )

export const useDeleteSchedule = () =>
  useScheduleMutation(
    ({ id, rowVersion }: { id: string; rowVersion?: string }) =>
      schedulingApi.deleteSchedule(id, rowVersion),
    () => 'Shift deleted',
  )

export const useSwapShift = () =>
  useScheduleMutation(
    ({ id, input }: { id: string; input: SwapInput }) => schedulingApi.swap(id, input),
    (_result, { input }) => (input.withScheduleId ? 'Shifts swapped' : 'Shift moved'),
  )

/** Downloads the filtered board as CSV (`GET /scheduling/schedules/export`). */
export function useExportSchedule() {
  return useMutation({
    mutationFn: async (params: Omit<BoardParams, 'page' | 'pageSize'>) => {
      const csv = await schedulingApi.exportCsv(params)
      return { csv, fileName: `schedule_${params.from}_${params.to}.csv` }
    },
    onSuccess: ({ csv, fileName }) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Schedule exported')
    },
  })
}
