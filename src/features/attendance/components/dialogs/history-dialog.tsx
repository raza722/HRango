import { useState } from 'react'
import { format, parseISO } from 'date-fns'

import { AppDialog } from '@/components/feedback/app-dialog'
import { EmployeeAvatar, Pagination } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

import { useDayHistory } from '../../hooks/use-attendance'
import type { DayKey } from '../../types/attendance.types'

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
                      <EmployeeAvatar name={entry.editedBy.name} className="size-8" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-person">
                          {entry.editedBy.name}
                        </span>
                        <span className="block text-[0.5625rem] text-grey">
                          {entry.editedBy.code}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="block">{entry.action}</span>
                    {entry.detail && (
                      <span className="block text-muted-foreground">{entry.detail}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {format(parseISO(entry.at), 'h:mmaaa, d MMM, yyyy')}
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
