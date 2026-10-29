import { useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { useTaskDetail } from '../../hooks/use-pm'
import type { PmAccess } from '../../hooks/use-pm-access'
import type { ExtensionRequest, TaskRow } from '../../types/pm.types'
import { formatCellDate, fromDay } from '../task-fields/field-utils'
import { ExtensionDecisionDialog, ExtensionRequestDialog } from './extension-dialogs'

const days = (count: number) => `${String(count)} ${count === 1 ? 'day' : 'days'}`

const chip = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap'
const smallButton =
  'inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]'

type Decision = { extension: ExtensionRequest; decision: 'approve' | 'reject' } | null

/**
 * A task's extension request and what the viewer may do with it: ask for one (an assignee of an
 * open task without one waiting or granted), or approve / reject a waiting one (a manager who
 * did not ask). Reads the task's detail, which carries its requests.
 */
function ExtensionCell({ task, access }: { task: TaskRow; access: PmAccess }) {
  const detail = useTaskDetail(task.id)
  const myEmployeeId = useAuthStore((state) => state.user?.employeeId ?? null)
  const [asking, setAsking] = useState(false)
  const [decision, setDecision] = useState<Decision>(null)
  if (detail.isPending) return <Skeleton className="h-6 w-28 rounded-md" />
  if (detail.isError) return <span className="text-xs text-[#909090]">Not loaded</span>

  const latest = detail.data.extensions[0]
  const open = task.closedAt === null
  const assigned = myEmployeeId !== null && task.assigneeIds.includes(myEmployeeId)
  const canAsk =
    open &&
    assigned &&
    access.requestExtension &&
    task.dueDate !== null &&
    (!latest || latest.status === 'rejected')

  return (
    <div className="flex flex-wrap items-center gap-2">
      {latest?.status === 'pending' && (
        <span
          className={cn(
            chip,
            'bg-[#FFF4E5] text-[#9A5B00] dark:bg-[#F79009]/15 dark:text-[#FFC266]',
          )}
          title={latest.reason ?? undefined}
        >
          Asked for {formatCellDate(latest.newDueDate)}
        </span>
      )}
      {latest?.status === 'approved' && (
        <span
          className={cn(
            chip,
            'bg-[#E7F7EC] text-[#1E7B3A] dark:bg-emerald-500/15 dark:text-emerald-300',
          )}
        >
          Extended to {formatCellDate(latest.newDueDate)}
        </span>
      )}
      {latest?.status === 'rejected' && (
        <span
          className={cn(
            chip,
            'bg-[#FDECEE] text-[#B7192C] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3]',
          )}
          title={latest.remarks ?? undefined}
        >
          Extension rejected
        </span>
      )}
      {!latest && !canAsk && <span className="text-sm text-[#909090]">None</span>}

      {latest?.status === 'pending' &&
        access.decideExtensions &&
        latest.requestedById !== myEmployeeId && (
          <>
            <button
              type="button"
              aria-label={`Approve the extension of ${task.name}`}
              onClick={() => {
                setDecision({ extension: latest, decision: 'approve' })
              }}
              className={cn(smallButton, 'bg-[#7127EA] text-white hover:bg-[#5f1fd0]')}
            >
              Approve
            </button>
            <button
              type="button"
              aria-label={`Reject the extension of ${task.name}`}
              onClick={() => {
                setDecision({ extension: latest, decision: 'reject' })
              }}
              className={cn(
                smallButton,
                'bg-[#FDECEE] text-[#B7192C] hover:bg-[#fbd5da] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3] dark:hover:bg-[#DC3545]/25',
              )}
            >
              Reject
            </button>
          </>
        )}
      {canAsk && (
        <button
          type="button"
          aria-label={`Request an extension of ${task.name}`}
          onClick={() => {
            setAsking(true)
          }}
          className={cn(
            smallButton,
            'border border-[#7127EA] text-[#7127EA] hover:bg-[#F0E9FD] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/25',
          )}
        >
          {latest ? 'Ask Again' : 'Request Extension'}
        </button>
      )}

      <ExtensionRequestDialog task={task} open={asking} onOpenChange={setAsking} />
      {decision && (
        <ExtensionDecisionDialog
          taskName={task.name}
          extension={decision.extension}
          decision={decision.decision}
          open
          onOpenChange={(next) => {
            if (!next) setDecision(null)
          }}
        />
      )}
    </div>
  )
}

/** The due date, with the first one when an approved extension moved it. */
function DueDate({ task }: { task: TaskRow }) {
  if (!task.dueDate) return <span className="text-[#909090]">—</span>
  return (
    <span className="grid">
      <span>{formatCellDate(task.dueDate)}</span>
      {task.originalDueDate && task.originalDueDate !== task.dueDate && (
        <span className="text-xs text-[#909090]">
          first due {formatCellDate(task.originalDueDate)}
        </span>
      )}
    </span>
  )
}

function TaskTable({
  caption,
  tasks,
  access,
  late,
  onOpenTask,
}: {
  caption: string
  tasks: readonly TaskRow[]
  access: PmAccess
  /** "3 days" past due, or "Closed 4/2/2026, 2 days late". */
  late: (task: TaskRow) => string
  onOpenTask: (task: TaskRow) => void
}) {
  const head =
    'px-3 py-2 text-left text-sm font-semibold whitespace-nowrap text-[#626262] dark:text-title'
  const cell = 'px-3 py-3 align-top text-sm text-[#303030] dark:text-title'
  return (
    <div className="relative overflow-x-auto rounded-[0.875rem] border border-[#ECECEC] bg-white dark:border-border dark:bg-card">
      <table className="w-full min-w-[44rem] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[#ECECEC] dark:border-border">
            <th scope="col" className={head}>
              Task
            </th>
            <th scope="col" className={head}>
              Assignees
            </th>
            <th scope="col" className={head}>
              Due Date
            </th>
            <th scope="col" className={head}>
              Late
            </th>
            <th scope="col" className={head}>
              Extension
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="border-b border-[#F2F2F2] last:border-0 dark:border-border"
            >
              <td className={cell}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask(task)
                  }}
                  className="grid text-left outline-none hover:text-[#7127EA] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:hover:text-[#C4ABFF]"
                >
                  <span className="font-medium">{task.name}</span>
                  <span className="text-xs text-[#909090]">
                    {[task.code, task.listName].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </td>
              <td className={cell}>
                {task.assignees.length > 0
                  ? task.assignees.map((entry) => entry.name).join(', ')
                  : '—'}
              </td>
              <td className={cell}>
                <DueDate task={task} />
              </td>
              <td className={cn(cell, 'whitespace-nowrap text-[#B7192C] dark:text-[#FF9AA3]')}>
                {late(task)}
              </td>
              <td className={cell}>
                <ExtensionCell task={task} access={access} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The Overdue tab (not drawn; the BRD's "overdue tab"): the open tasks past their due date, then
 * the tasks closed after it, each with both dates and its extension request. Read from the tasks
 * the workspace page already has (their `isOverdue` and `isClosedLate`). The story-point penalty
 * for late work is not defined (Backend Dependencies T5), so none is shown.
 */
export function OverdueView({
  tasks,
  access,
  onOpenTask,
}: {
  tasks: readonly TaskRow[]
  access: PmAccess
  onOpenTask: (task: TaskRow) => void
}) {
  const today = new Date()
  const overdue = tasks
    .filter((task) => task.isOverdue)
    .toSorted((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const closedLate = tasks
    .filter((task) => task.isClosedLate)
    .toSorted((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="overdue-open-title" className="flex flex-col gap-3">
        <div>
          <h2
            id="overdue-open-title"
            className="text-lg font-semibold text-[#303030] dark:text-title"
          >
            Overdue ({overdue.length})
          </h2>
          <p className="text-sm text-[#707070] dark:text-grey">
            Open tasks past their due date. An assignee can ask for a later date once; a manager
            approves or rejects it.
          </p>
        </div>
        {overdue.length === 0 ? (
          <p className="rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-10 text-center text-sm text-[#707070] dark:border-border dark:bg-card dark:text-grey">
            Nothing is overdue.
          </p>
        ) : (
          <TaskTable
            caption="Overdue tasks"
            tasks={overdue}
            access={access}
            onOpenTask={onOpenTask}
            late={(task) =>
              task.dueDate ? days(differenceInCalendarDays(today, fromDay(task.dueDate))) : '—'
            }
          />
        )}
      </section>

      <section aria-labelledby="overdue-closed-title" className="flex flex-col gap-3">
        <div>
          <h2
            id="overdue-closed-title"
            className="text-lg font-semibold text-[#303030] dark:text-title"
          >
            Closed late ({closedLate.length})
          </h2>
          <p className="text-sm text-[#707070] dark:text-grey">Finished after their due date.</p>
        </div>
        {closedLate.length === 0 ? (
          <p className="rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-10 text-center text-sm text-[#707070] dark:border-border dark:bg-card dark:text-grey">
            No task was closed late.
          </p>
        ) : (
          <TaskTable
            caption="Tasks closed late"
            tasks={closedLate}
            access={access}
            onOpenTask={onOpenTask}
            late={(task) => {
              if (!task.closedAt || !task.dueDate) return '—'
              const closed = parseISO(task.closedAt)
              return `Closed ${formatCellDate(task.closedAt.slice(0, 10))}, ${days(
                differenceInCalendarDays(closed, fromDay(task.dueDate)),
              )} late`
            }}
          />
        )}
      </section>
    </div>
  )
}
