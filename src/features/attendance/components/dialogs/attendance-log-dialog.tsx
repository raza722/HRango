import { AppDialog } from '@/components/feedback/app-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../constants'
import type { PunchLog } from '../../types/attendance.types'
import { punchDescription } from '../../utils/day'
import { formatPunchTime } from '../../utils/local-time'
import { interDialogClass } from '../../utils/settings-styles'

/**
 * "Attendance Log": every punch of the day (from the day detail), where it came
 * from and whether HR typed it. Ignored punches are struck through.
 */
export function AttendanceLogDialog({
  punches,
  onClose,
}: {
  /** Undefined while the day loads. */
  punches: readonly PunchLog[] | undefined
  onClose: () => void
}) {
  const rows = punches ?? []
  return (
    <AppDialog title="Attendance Log" onRequestClose={onClose} className={interDialogClass}>
      <div className="scrollbar-brand overflow-x-auto">
        <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="[&>th]:h-14 [&>th]:border-r [&>th]:border-white/40 [&>th]:bg-primary [&>th]:px-4 [&>th]:text-center [&>th]:font-medium [&>th]:text-primary-foreground [&>th:last-child]:border-r-0">
              <th scope="col">Punch Type</th>
              <th scope="col">Punch Time</th>
              <th scope="col">Description</th>
              <th scope="col">Type</th>
              <th scope="col">Is Manually Updated</th>
            </tr>
          </thead>
          <tbody>
            {punches === undefined ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <Skeleton className="h-10 w-full" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No punches recorded for this day.
                </td>
              </tr>
            ) : (
              rows.map((log) => (
                <tr
                  key={log.id}
                  className="bg-[#F4F4F4] text-[#303030] dark:bg-muted/40 dark:text-field-foreground [&>td]:border-r [&>td]:border-b [&>td]:border-[#E2E2E2] [&>td]:px-4 [&>td]:py-4 [&>td]:text-center dark:[&>td]:border-border [&>td:last-child]:border-r-0"
                >
                  <td className={log.isIgnored ? 'line-through' : undefined}>
                    {PUNCH_TYPE_LABELS[log.punchType]}
                    {log.isIgnored && <span className="sr-only"> (ignored)</span>}
                  </td>
                  <td className="whitespace-nowrap">{formatPunchTime(log.punchedAt)}</td>
                  <td className="max-w-56 text-left">{punchDescription(log)}</td>
                  <td className="whitespace-nowrap">{PUNCH_SOURCE_LABELS[log.source]}</td>
                  <td>
                    <Checkbox
                      checked={log.isManuallyUpdated}
                      disabled
                      aria-label={
                        log.isManuallyUpdated ? 'Manually updated' : 'Not manually updated'
                      }
                      className="mx-auto disabled:opacity-100"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppDialog>
  )
}
