import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { attendanceKeys } from '../api/attendance.api'
import { attendanceLogsQueryOptions, logsApi } from '../api/logs.api'
import type { PunchLog } from '../types/attendance.types'
import type { AttendanceLogInput, AttendanceLogParams, FileImportRow } from '../types/logs.types'

export function useAttendanceLogs(params: AttendanceLogParams) {
  return useQuery(attendanceLogsQueryOptions(params))
}

/** A punch change: the logs and the time sheets (the API re-processes the day) refetch. */
function useLogMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: (variables: TVariables, result: TResult) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      toast.success(message(variables, result))
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

export const useSaveLog = () =>
  useLogMutation(
    ({ id, input }: { id?: string | undefined; input: AttendanceLogInput }) =>
      id ? logsApi.update(id, input) : logsApi.create(input),
    ({ id }) => (id ? 'Attendance log updated' : 'Attendance log created'),
  )

export const useDeleteLog = () =>
  useLogMutation(
    (punch: PunchLog) => logsApi.remove(punch),
    () => 'Attendance log deleted',
  )

/** Ignore (or count again) a machine, dashboard or request punch. */
export const useIgnoreLog = () =>
  useLogMutation(
    ({ punch, ignored }: { punch: PunchLog; ignored: boolean }) =>
      logsApi.setIgnored(punch, ignored),
    ({ ignored }) => (ignored ? 'Punch ignored' : 'Punch counted again'),
  )

export const useImportFile = () =>
  useLogMutation(
    (rows: FileImportRow[]) => logsApi.importFile(rows),
    (_variables, result) =>
      `Imported ${result.created} punch${result.created === 1 ? '' : 'es'}${result.skipped ? `, ${result.skipped} skipped` : ''}${result.failed ? `, ${result.failed} failed` : ''}`,
  )
