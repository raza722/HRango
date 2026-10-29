import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, PageContainer } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { useDeleteReminder, useMoveReminder, useReminders } from '../../hooks/use-pm'
import type { ReminderEntry } from '../../types/pm.types'
import { ReminderPopover } from '../workspace/reminder-popover'

const stamp = (iso: string) => format(parseISO(iso), 'd MMM yyyy, h:mm a')

const smallButton =
  'inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/** Upcoming, Sent (the server delivered it) or Past (its time went by unsent), as of `now`. */
function StatusChip({ reminder, now }: { reminder: ReminderEntry; now: number }) {
  const past = parseISO(reminder.remindAt).getTime() < now
  const [label, tone] = reminder.notifiedAt
    ? ['Sent', 'bg-[#E7F7EC] text-[#1E7B3A] dark:bg-emerald-500/15 dark:text-emerald-300']
    : past
      ? ['Past', 'bg-muted text-grey']
      : ['Upcoming', 'bg-sidebar/10 text-sidebar dark:bg-primary/20 dark:text-heading']
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', tone)}>
      {label}
    </span>
  )
}

/** What the reminder is about: a task opens in its workspace's List view. */
function Subject({ reminder }: { reminder: ReminderEntry }) {
  const name = reminder.entityName ?? reminder.name
  if (reminder.entityType !== 'task') return <span>{name}</span>
  return (
    <Link
      to="/project-management/workspaces/$workspaceId"
      params={{ workspaceId: reminder.workspaceId }}
      hash={reminder.entityId}
      className="text-primary underline-offset-2 hover:underline"
    >
      {name}
    </Link>
  )
}

function Actions({ reminder, canChange }: { reminder: ReminderEntry; canChange: boolean }) {
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const move = useMoveReminder()
  const remove = useDeleteReminder()
  if (!canChange) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReminderPopover
        open={moving}
        onOpenChange={setMoving}
        value={reminder.remindAt}
        taskName={reminder.entityName ?? reminder.name}
        onSave={(at) => {
          if (at) move.mutate({ reminder, at })
          else remove.mutate(reminder.id)
        }}
      >
        <button
          type="button"
          aria-label={`Change the time of the reminder about ${reminder.name}`}
          onClick={() => {
            setMoving(true)
          }}
          className={cn(
            smallButton,
            'border border-sidebar text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading',
          )}
        >
          Change time
        </button>
      </ReminderPopover>
      <button
        type="button"
        aria-label={`Delete the reminder about ${reminder.name}`}
        onClick={() => {
          setDeleting(true)
        }}
        className={cn(smallButton, 'text-destructive hover:bg-destructive/10')}
      >
        Delete
      </button>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete reminder?"
        description={`The reminder about "${reminder.name}" on ${stamp(reminder.remindAt)} will be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          remove.mutate(reminder.id)
        }}
      />
    </div>
  )
}

/**
 * Reminders (not drawn; the BRD's "own reminders"): the signed-in person's Project Management
 * reminders (`GET /projects/reminders`), soonest first, with the sent and past ones on request;
 * Change time (the Remind Me calendar) and Delete. Reminders are set from a task's Remind Me.
 * The server does not deliver them as notifications yet (Backend Dependencies T4).
 */
export function RemindersPage() {
  const [includeDone, setIncludeDone] = useState(false)
  // When the page opened: what counts as past.
  const [now] = useState(() => Date.now())
  const list = useReminders(includeDone)
  const canChange = useCan('projects.reminders.create')

  const columns: DataTableColumn<ReminderEntry>[] = [
    {
      id: 'name',
      header: 'Reminder',
      mobile: 'heading',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => row.name,
    },
    {
      id: 'subject',
      header: 'About',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => <Subject reminder={row} />,
    },
    {
      id: 'at',
      header: 'Remind At',
      cell: (row) => <span className="whitespace-nowrap">{stamp(row.remindAt)}</span>,
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip reminder={row} now={now} /> },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      cell: (row) => <Actions reminder={row} canChange={canChange} />,
    },
  ]

  return (
    <PageContainer>
      <section
        aria-labelledby="pm-reminders-title"
        className="grid gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 id="pm-reminders-title" className="text-xl font-medium text-title">
              Reminders
            </h1>
            <p className="text-sm text-muted-foreground">
              Your reminders on tasks. Set one from a task&apos;s Remind Me. The server does not
              send them as notifications yet, so they are listed here.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-heading">
            <Checkbox
              checked={includeDone}
              onCheckedChange={(checked) => {
                setIncludeDone(checked === true)
              }}
            />
            Show sent and past reminders
          </label>
        </div>

        {list.isError ? (
          <ErrorState
            title="Could not load your reminders"
            message={list.error.message}
            onRetry={() => void list.refetch()}
            className="shadow-none"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data ?? []}
            getRowId={(row) => row.id}
            caption="Reminders"
            isLoading={list.isPending}
            emptyState={
              <p className="py-10 text-center text-sm text-grey">
                {includeDone
                  ? 'You have no reminders.'
                  : 'No reminders coming up. Use Remind Me on a task to add one.'}
              </p>
            }
          />
        )}
      </section>
    </PageContainer>
  )
}
