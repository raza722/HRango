import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowRight, History, Loader2 } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useWarningHistory } from '../../hooks/use-warning-history'
import type { WarningHistoryEntry } from '../../types/warning-history.types'
import {
  describeHistoryEntry,
  describeHistoryValue,
  groupHistoryByDay,
  HISTORY_FIELD_LABELS,
} from '../../utils/history-grouping'
import { formatServerTime, parseServerTime } from '../../utils/server-time'
import { warningType } from '../type-styles'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Details shown under an entry after "View". */
function EntryDetails({
  entry,
  onOpenRecord,
}: {
  entry: WarningHistoryEntry
  onOpenRecord: () => void
}) {
  const field = entry.fieldName ? (HISTORY_FIELD_LABELS[entry.fieldName] ?? entry.fieldName) : null
  return (
    <div className="mt-3 rounded-md bg-muted px-4 py-3 text-sm sm:ml-[8.5rem]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        {field && entry.actionName === 'update' && (
          <>
            <dt className="text-label">{field}</dt>
            <dd className="break-words text-heading">
              {describeHistoryValue(entry.fieldName, entry.oldValue)} →{' '}
              {describeHistoryValue(entry.fieldName, entry.newValue)}
            </dd>
          </>
        )}
        <dt className="text-label">By</dt>
        <dd className="text-heading">{entry.performedByName ?? '—'}</dd>
        <dt className="text-label">When</dt>
        <dd className="text-heading">{formatServerTime(entry.performedAt)}</dd>
      </dl>
      {entry.policyId && entry.actionName !== 'delete' && (
        <Button variant="link" className="mt-2 h-auto p-0" onClick={onOpenRecord}>
          Open policy <ArrowRight />
        </Button>
      )}
    </div>
  )
}

/**
 * "History" dialog of the Warning module: every change to a policy (penalties are saved with
 * their policy), grouped by day ("Today - …", "Yesterday - …"), with View per entry. The log is
 * an audit trail: there is no Delete or Delete All.
 */
export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const history = useWarningHistory(open)
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const entries = useMemo(
    () => history.data?.pages.flatMap((page) => page.data) ?? [],
    [history.data],
  )
  const total = history.data?.pages[0]?.meta.total ?? 0
  const days = useMemo(() => groupHistoryByDay(entries), [entries])

  const openRecord = (entry: WarningHistoryEntry) => {
    if (!entry.policyId) return
    onOpenChange(false)
    void navigate({ to: '/warning/policy/$policyId', params: { policyId: entry.policyId } })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setExpandedId(null)
        onOpenChange(next)
      }}
    >
      {/* Not drawn; Inter, as the rest of the Warning module. */}
      <DialogContent className="max-h-[min(48rem,calc(100dvh-2rem))] max-w-3xl font-inter">
        <DialogHeader className="justify-between">
          <DialogTitle>History</DialogTitle>
          <DialogDescription className="sr-only">
            Changes made to warning policies and their penalties.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6 sm:px-8 sm:pb-8">
          {history.isPending ? (
            <div className="flex flex-col gap-4 pt-4" aria-busy="true">
              <span className="sr-only">Loading history</span>
              <Skeleton className="h-6 w-64" />
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : history.error ? (
            <ErrorState
              message={history.error.message}
              onRetry={() => {
                void history.refetch()
              }}
              className="mt-4 shadow-none"
            />
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <History className="size-10 text-chip" aria-hidden="true" />
              <p>No changes recorded yet.</p>
            </div>
          ) : (
            <>
              {days.map((day) => (
                <section key={day.key} aria-label={day.label} className="pt-4 first:pt-2">
                  <h3 className="py-2 text-base text-label sm:text-xl">{day.label}</h3>
                  <ul>
                    {day.entries.map((entry) => {
                      const description = describeHistoryEntry(entry)
                      const expanded = expandedId === entry.id
                      const at = parseServerTime(entry.performedAt)
                      return (
                        <li key={entry.id} className="py-3 sm:py-4">
                          <div className="flex items-center gap-3 sm:gap-6">
                            <time
                              dateTime={at?.toISOString()}
                              className="w-[4.5rem] shrink-0 text-sm text-label sm:w-28 sm:text-lg"
                            >
                              {at ? format(at, 'h:mm a') : '—'}
                            </time>
                            <p
                              className={cn(
                                'min-w-0 flex-1 break-words text-heading sm:text-lg',
                                expanded && 'font-medium',
                              )}
                            >
                              {description}
                            </p>
                            <RowActionsMenu
                              label={`Actions for ${description}`}
                              itemClassName={warningType.rowMenuItem}
                              actions={[
                                {
                                  label: expanded ? 'Hide details' : 'View',
                                  onSelect: () => {
                                    setExpandedId(expanded ? null : entry.id)
                                  },
                                },
                              ]}
                            />
                          </div>
                          {expanded && (
                            <EntryDetails
                              entry={entry}
                              onOpenRecord={() => {
                                openRecord(entry)
                              }}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              {history.hasNextPage && (
                <div className="flex flex-col items-center gap-2 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {entries.length} of {total}
                  </p>
                  <Button
                    variant="outline"
                    disabled={history.isFetchingNextPage}
                    onClick={() => {
                      void history.fetchNextPage()
                    }}
                  >
                    {history.isFetchingNextPage && <Loader2 className="animate-spin" />} Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
