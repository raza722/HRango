import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { ArrowRight, History } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
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
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'

import {
  useClearHistory,
  useDeleteHistoryEntry,
  useWarningHistory,
} from '../../hooks/use-warning-history'
import type { WarningHistoryEntry } from '../../types/warning-history.types'
import { describeHistoryEntry, groupHistoryByDay } from '../../utils/history-grouping'
import { warningType } from '../type-styles'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACTION_TEXT = { created: 'Created', updated: 'Updated', deleted: 'Deleted' } as const

/** Details shown under an entry after "View". */
function EntryDetails({
  entry,
  onOpenRecord,
}: {
  entry: WarningHistoryEntry
  onOpenRecord: () => void
}) {
  return (
    <div className="mt-3 rounded-md bg-muted px-4 py-3 text-sm sm:ml-[8.5rem]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        <dt className="text-label">Change</dt>
        <dd className="text-heading">
          {ACTION_TEXT[entry.action]} {entry.entity}
        </dd>
        <dt className="text-label">Record</dt>
        <dd className="break-words text-heading">{entry.recordTitle}</dd>
        <dt className="text-label">By</dt>
        <dd className="text-heading">{entry.actor}</dd>
        <dt className="text-label">When</dt>
        <dd className="text-heading">{formatDateTime(entry.occurredAt)}</dd>
      </dl>
      {entry.action !== 'deleted' && (
        <Button variant="link" className="mt-2 h-auto p-0" onClick={onOpenRecord}>
          Open {entry.entity} <ArrowRight />
        </Button>
      )}
    </div>
  )
}

/**
 * "History" dialog of the Warning module: every change to a policy or
 * penalty, grouped by day ("Today - …", "Yesterday - …"), with View / Delete
 * per entry and "Delete All".
 */
export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const history = useWarningHistory(open)
  const deleteEntry = useDeleteHistoryEntry()
  const clearHistory = useClearHistory()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const entries = history.data ?? []
  const days = useMemo(() => groupHistoryByDay(history.data ?? []), [history.data])

  const openRecord = (entry: WarningHistoryEntry) => {
    onOpenChange(false)
    if (entry.entity === 'policy') {
      void navigate({ to: '/warning/policy/$policyId', params: { policyId: entry.recordId } })
    } else {
      void navigate({ to: '/warning/penalty', search: { edit: entry.recordId } })
    }
  }

  return (
    <>
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
              Changes made to warning policies and penalties.
            </DialogDescription>
            <Button
              variant="destructive"
              disabled={entries.length === 0 || clearHistory.isPending}
              onClick={() => {
                setConfirmClear(true)
              }}
            >
              Delete All
            </Button>
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
              days.map((day) => (
                <section key={day.key} aria-label={day.label} className="pt-4 first:pt-2">
                  <h3 className="py-2 text-base text-label sm:text-xl">{day.label}</h3>
                  <ul>
                    {day.entries.map((entry) => {
                      const description = describeHistoryEntry(entry)
                      const expanded = expandedId === entry.id
                      return (
                        <li key={entry.id} className="py-3 sm:py-4">
                          <div className="flex items-center gap-3 sm:gap-6">
                            <time
                              dateTime={entry.occurredAt}
                              className="w-[4.5rem] shrink-0 text-sm text-label sm:w-28 sm:text-lg"
                            >
                              {format(parseISO(entry.occurredAt), 'h:mm a')}
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
                                {
                                  label: 'Delete',
                                  variant: 'destructive',
                                  onSelect: () => {
                                    deleteEntry.mutate(entry)
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
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete all history?"
        description={`All ${entries.length} entries will be removed. The policies and penalties themselves are not changed.`}
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={() => {
          clearHistory.mutate()
          setConfirmClear(false)
        }}
      />
    </>
  )
}
