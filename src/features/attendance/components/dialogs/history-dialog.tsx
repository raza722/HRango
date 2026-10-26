import { useState } from 'react'
import { format, parseISO } from 'date-fns'

import { AppDialog } from '@/components/feedback/app-dialog'
import { EmployeeAvatar, Pagination } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

import { useDayHistory } from '../../hooks/use-attendance'
import type { DayKey, HistoryEntry } from '../../types/attendance.types'
import { formatClockTime } from '../../utils/local-time'

/** Field names of the audit log → the words of the Edit dialog. */
const FIELD_LABELS: Record<string, string> = {
  expected_in: 'Expected Check In',
  expected_out: 'Expected Check Out',
  first_in: 'Check In Time',
  last_out: 'Check Out Time',
  marked_status: 'Mark',
  breaks: 'Breaks',
  comments: 'Comments',
}

const MARK_LABELS: Record<string, string> = {
  absent: 'Absent',
  half_day: 'Half Day',
  short_day: 'Short Day',
}

/** A logged value as people read it: times as "09:05 AM", marks in words, empty as "—". */
function shown(value: string | null): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && value.length <= 19) {
    return formatClockTime(value.slice(0, 16))
  }
  return MARK_LABELS[value] ?? value
}

function actionOf(entry: HistoryEntry): string {
  const field = entry.fieldName ? (FIELD_LABELS[entry.fieldName] ?? entry.fieldName) : null
  const verb = entry.actionName ? entry.actionName.replace(/_/g, ' ') : 'Updated'
  const sentence = field ? `${verb} ${field}` : verb
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** "History": who changed the day, what and when, newest first. */
export function HistoryDialog({ dayKey, onClose }: { dayKey: DayKey; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const history = useDayHistory(dayKey, page)
  const entries = history.data?.data ?? []
  const meta = history.data?.meta

  return (
    <AppDialog
      title="History"
      onRequestClose={onClose}
      className="max-w-2xl"
      titleClassName="text-[#202020] dark:text-heading"
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[30rem] text-[0.6875rem] text-grey">
          <thead className="bg-muted text-left text-sm text-title">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
              <th scope="col">Edited By</th>
              <th scope="col">Action</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {history.isPending ? (
              <tr>
                <td colSpan={3} className="p-4">
                  <Skeleton className="h-10 w-full" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No changes to this day yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top [&>td]:px-4 [&>td]:py-2.5">
                  <td>
                    <span className="flex items-center gap-2.5">
                      <EmployeeAvatar name={entry.performedByName ?? '?'} className="size-8" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-person">
                          {entry.performedByName ?? 'System'}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="block">{actionOf(entry)}</span>
                    {(entry.oldValue !== null || entry.newValue !== null) &&
                      entry.fieldName !== 'comments' && (
                        <span className="block text-muted-foreground">
                          {shown(entry.oldValue)} → {shown(entry.newValue)}
                        </span>
                      )}
                  </td>
                  <td className="whitespace-nowrap">
                    {entry.performedAt
                      ? format(parseISO(entry.performedAt), 'h:mmaaa, d MMM, yyyy')
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          disabled={history.isFetching}
          onPageChange={setPage}
          className="mt-4 justify-end"
        />
      )}
    </AppDialog>
  )
}
