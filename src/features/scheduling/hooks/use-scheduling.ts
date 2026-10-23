import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  activeShiftQueryOptions,
  boardQueryOptions,
  employeesQueryOptions,
  entryQueryOptions,
  geoFencesQueryOptions,
  lookupsQueryOptions,
  schedulingApi,
  schedulingKeys,
} from '../api/scheduling.api'
import type {
  ApplyDefaultShiftInput,
  BatchResult,
  BoardParams,
  CreateScheduleInput,
  DeleteScheduleInput,
  EmployeeFilters,
  EntryPatch,
  GeoFenceInput,
  ImportRow,
  RestDayInput,
  SwapInput,
} from '../types/scheduling.types'

export function useScheduleBoard(params: BoardParams) {
  return useQuery(boardQueryOptions(params))
}

export function useActiveShift() {
  return useQuery(activeShiftQueryOptions())
}

export function useSchedulingLookups() {
  return useQuery(lookupsQueryOptions())
}

export function useEmployeeSearch(filters: EmployeeFilters & { search?: string }) {
  return useQuery(employeesQueryOptions(filters))
}

export function useScheduleEntry(id: string | undefined) {
  return useQuery({ ...entryQueryOptions(id ?? ''), enabled: id !== undefined })
}

export function useGeoFences() {
  return useQuery(geoFencesQueryOptions())
}

/** "3 shifts created, 1 updated" from a batch result. */
export function describeBatch(result: BatchResult, noun = 'day'): string {
  const count = (amount: number) => `${amount} ${noun}${amount === 1 ? '' : 's'}`
  const parts = [
    result.created && `${count(result.created)} added`,
    result.updated && `${count(result.updated)} updated`,
    result.deleted && `${count(result.deleted)} deleted`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Nothing changed'
}

/**
 * A schedule change: on success the board, the "Active Status" box and any
 * open entry refetch, and a toast describes what happened.
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

export const useCreateSchedule = () =>
  useScheduleMutation(
    (input: CreateScheduleInput) => schedulingApi.createSchedule(input),
    (result) => `Schedule saved: ${describeBatch(result)}`,
    { suppressErrorToast: true },
  )

export const useApplyDefaultShift = () =>
  useScheduleMutation(
    (input: ApplyDefaultShiftInput) => schedulingApi.applyDefault(input),
    (result) => `Default shift applied: ${describeBatch(result)}`,
  )

export const useDeleteScheduleRange = () =>
  useScheduleMutation(
    (input: DeleteScheduleInput) => schedulingApi.deleteRange(input),
    (result) =>
      result.deleted === 0
        ? 'There was nothing to delete in that range'
        : `${result.deleted} scheduled day${result.deleted === 1 ? '' : 's'} deleted`,
  )

export const useCreateRestDays = () =>
  useScheduleMutation(
    (input: RestDayInput) => schedulingApi.createRestDays(input),
    (result) => `Rest days saved: ${describeBatch(result, 'rest day')}`,
  )

export const useUpdateEntry = () =>
  useScheduleMutation(
    ({ id, patch }: { id: string; patch: EntryPatch }) => schedulingApi.updateEntry(id, patch),
    () => 'Schedule updated',
  )

export const useBulkUpdateEntries = () =>
  useScheduleMutation(
    ({ ids, patch }: { ids: string[]; patch: EntryPatch }) => schedulingApi.bulkUpdate(ids, patch),
    (result) => `${result.updated} scheduled day${result.updated === 1 ? '' : 's'} updated`,
  )

export const useBulkDeleteEntries = () =>
  useScheduleMutation(
    (ids: string[]) => schedulingApi.bulkDelete(ids),
    (result) =>
      `${result.deleted} shift${result.deleted === 1 ? '' : 's'} deleted` +
      (result.skipped ? `, ${result.skipped} rest day${result.skipped === 1 ? '' : 's'} kept` : ''),
  )

export const useDeleteEntry = () =>
  useScheduleMutation(
    (id: string) => schedulingApi.deleteEntry(id),
    () => 'Shift deleted',
  )

export const useSwapShift = () =>
  useScheduleMutation(
    (input: SwapInput) => schedulingApi.swap(input),
    (result) => (result.updated === 2 ? 'Shifts swapped' : 'Shift moved'),
  )

export const useImportSchedule = () =>
  useScheduleMutation(
    (rows: ImportRow[]) => schedulingApi.importRows(rows),
    (result) =>
      `Import finished: ${describeBatch(result)}` +
      (result.skipped ? `, ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped` : ''),
  )

export function useCreateGeoFence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GeoFenceInput) => schedulingApi.createGeoFence(input),
    meta: { suppressErrorToast: true },
    onSuccess: async (fence) => {
      toast.success(`Geo fence “${fence.name}” created`)
      await queryClient.invalidateQueries({ queryKey: schedulingKeys.geoFences() })
    },
  })
}
