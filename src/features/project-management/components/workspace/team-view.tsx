import { useMemo, useState } from 'react'
import { endOfWeek, isWithinInterval, parseISO, startOfWeek, subDays } from 'date-fns'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import { cn } from '@/lib/utils'

import type { PmPerson, PmRole, TaskRow, TaskStatus, Workspace } from '../../types/pm.types'
import { formatDuration, fromDay } from '../task-fields/field-utils'
import { NO_ASSIGNEE } from './list-utils'

const ROLE_NAMES: Record<PmRole, string> = {
  'workspace-admin': 'Workspace admin',
  hr: 'HR',
  managers: 'Manager',
  'team-leaders': 'Team leader',
  contributors: 'Contributor',
}

interface Workload {
  /** An employee id, or `NO_ASSIGNEE` for the tasks nobody has. */
  id: string
  name: string
  role: string | null
  photoUrl: string | null
  /** Open tasks per status id. */
  byStatus: Map<string, number>
  open: number
  overdue: number
  dueThisWeek: number
  doneLast30: number
  points: number | null
  estimateMinutes: number
}

const isClosed = (statuses: readonly TaskStatus[], task: TaskRow) => {
  const group = statuses.find((status) => status.id === task.statusId)?.group
  return group === 'done' || group === 'closed'
}

/** Each member's share of the tasks (subtasks included), then the unassigned ones. */
function workloads(
  workspace: Workspace,
  tasks: readonly TaskRow[],
  people: ReadonlyMap<string, PmPerson>,
  now: Date,
): Workload[] {
  const statuses = workspace.setup.statuses
  const week = { start: startOfWeek(now), end: endOfWeek(now) }
  const monthAgo = subDays(now, 30)
  const rows = new Map<string, Workload>()
  const blank = (id: string, name: string, role: string | null, photoUrl: string | null) => ({
    id,
    name,
    role,
    photoUrl,
    byStatus: new Map<string, number>(),
    open: 0,
    overdue: 0,
    dueThisWeek: 0,
    doneLast30: 0,
    points: id === NO_ASSIGNEE ? null : 0,
    estimateMinutes: 0,
  })
  for (const member of workspace.members) {
    const person = people.get(member.employeeId)
    rows.set(
      member.employeeId,
      blank(
        member.employeeId,
        person?.name ?? member.name,
        ROLE_NAMES[member.role],
        person?.photoUrl ?? null,
      ),
    )
  }
  const unassigned = blank(NO_ASSIGNEE, 'Unassigned', null, null)

  for (const task of tasks) {
    const owners = task.assigneeIds.length
      ? task.assigneeIds.map((id) => {
          let row = rows.get(id)
          if (!row) {
            // Assigned but no longer a member: still counted, without a role.
            const person = people.get(id)
            row = blank(id, person?.name ?? 'Former member', null, person?.photoUrl ?? null)
            rows.set(id, row)
          }
          return row
        })
      : [unassigned]
    const closed = isClosed(statuses, task)
    for (const row of owners) {
      if (closed) {
        if (task.closedAt && parseISO(task.closedAt) >= monthAgo) row.doneLast30 += 1
        continue
      }
      row.open += 1
      row.byStatus.set(task.statusId, (row.byStatus.get(task.statusId) ?? 0) + 1)
      if (task.isOverdue) row.overdue += 1
      if (task.dueDate && isWithinInterval(fromDay(task.dueDate), week)) row.dueThisWeek += 1
      row.estimateMinutes += task.timeEstimateMinutes ?? 0
      if (row.points !== null) {
        row.points += task.storyPoints.find((entry) => entry.employeeId === row.id)?.points ?? 0
      }
    }
  }
  const busiestFirst = [...rows.values()].toSorted(
    (a, b) => b.open - a.open || a.name.localeCompare(b.name),
  )
  return [...busiestFirst, unassigned]
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${String(count)} ${count === 1 ? one : many}`

/** Text cells: a visible label while the view is narrow, read out (not shown) when it is wide. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'alert' | undefined
}) {
  return (
    <span className="flex items-baseline gap-1 @4xl/team:block @4xl/team:text-right">
      <span className="text-[0.6875rem] text-[#909090] @4xl/team:sr-only">{label}</span>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          tone === 'alert'
            ? 'text-[#B7192C] dark:text-[#FF9AA3]'
            : 'text-[#303030] dark:text-title',
        )}
      >
        {value}
      </span>
    </span>
  )
}

/** Open tasks as a bar stacked by status, as long as the busiest person's is the whole track. */
function WorkloadBar({
  row,
  statuses,
  max,
}: {
  row: Workload
  statuses: readonly TaskStatus[]
  max: number
}) {
  const parts = statuses
    .map((status) => ({ status, count: row.byStatus.get(status.id) ?? 0 }))
    .filter((part) => part.count > 0)
  return (
    <span className="flex h-3 w-full rounded bg-[#F3F3F3] dark:bg-white/5" aria-hidden="true">
      {row.open > 0 && (
        <span
          className="flex h-full gap-0.5"
          style={{ width: `${String(Math.max(4, (row.open / max) * 100))}%` }}
        >
          {parts.map((part) => (
            <span
              key={part.status.id}
              className="group/segment relative h-full first:rounded-l last:rounded-r"
              style={{ flexGrow: part.count, flexBasis: 0, backgroundColor: part.status.color }}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-[#303030] px-2 py-1 text-xs whitespace-nowrap text-white shadow group-hover/segment:block">
                {part.status.name}: {plural(part.count, 'task')}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

const GRID =
  '@4xl/team:grid @4xl/team:grid-cols-[minmax(11rem,1.3fr)_minmax(9rem,2fr)_repeat(6,minmax(3.75rem,0.45fr))] @4xl/team:items-center @4xl/team:gap-4'

/**
 * The Team view (not drawn; approved layout): each member's open tasks as a bar stacked by
 * status, with their overdue, due this week, done in the last 30 days, story points and the
 * estimate of their open tasks; the unassigned tasks last. A person opens the List view filtered
 * to their tasks. A task shared by two people counts for both.
 */
export function TeamView({
  workspace,
  tasks,
  narrowed,
  people,
  onShowPerson,
}: {
  workspace: Workspace
  /** The tasks the banner search and Filters keep. */
  tasks: readonly TaskRow[]
  narrowed: boolean
  people: ReadonlyMap<string, PmPerson>
  /** An employee id, or `NO_ASSIGNEE`. */
  onShowPerson: (id: string) => void
}) {
  const [now] = useState(() => new Date())
  const rows = useMemo(
    () => workloads(workspace, tasks, people, now),
    [workspace, tasks, people, now],
  )
  const statuses = workspace.setup.statuses.filter(
    (status) => status.group !== 'done' && status.group !== 'closed',
  )
  const max = Math.max(1, ...rows.map((row) => row.open))
  const open = tasks.filter((task) => !isClosed(workspace.setup.statuses, task)).length
  const unassigned = rows.at(-1)?.open ?? 0

  return (
    <div className="@container/team flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-white px-4 py-3 dark:bg-card">
        <p className="text-sm text-[#5A5A5A] dark:text-title">
          <span className="font-medium text-[#303030] dark:text-title">
            {plural(open, 'open task')}
          </span>{' '}
          across {plural(workspace.members.length, 'member')}
          {unassigned > 0 && <>, {unassigned} unassigned</>}
          {narrowed && <span className="text-[#909090]"> · counting the tasks that match</span>}
        </p>
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {statuses.map((status) => (
            <li
              key={status.id}
              className="flex items-center gap-1.5 text-xs text-[#5A5A5A] dark:text-title"
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: status.color }}
              />
              {status.name}
            </li>
          ))}
          <li className="text-xs text-[#909090]">Bars: open tasks</li>
        </ul>
      </div>

      <div className="rounded-xl bg-white dark:bg-card">
        <div
          aria-hidden="true"
          className={cn(
            GRID,
            'hidden border-b border-[#F1F1F1] px-4 py-2.5 text-xs font-medium text-[#909090] dark:border-border',
          )}
        >
          <span>Member</span>
          <span>Workload</span>
          <span className="text-right">Open</span>
          <span className="text-right">Overdue</span>
          <span className="text-right">This week</span>
          <span className="text-right">Done · 30d</span>
          <span className="text-right">Points</span>
          <span className="text-right">Estimate</span>
        </div>
        <ul aria-label="Team workload" className="divide-y divide-[#F1F1F1] dark:divide-border">
          {rows.map((row) => {
            const breakdown = statuses
              .map((status) => [status.name, row.byStatus.get(status.id) ?? 0] as const)
              .filter(([, count]) => count > 0)
              .map(([name, count]) => `${name} ${String(count)}`)
              .join(', ')
            const clickable = row.id !== NO_ASSIGNEE || row.open > 0
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    onShowPerson(row.id)
                  }}
                  aria-label={
                    row.id === NO_ASSIGNEE
                      ? 'Unassigned tasks: show them in the List view'
                      : `${row.name}: show their tasks in the List view`
                  }
                  aria-describedby={`team-row-${row.id}`}
                  className={cn(
                    GRID,
                    'flex w-full flex-col gap-2.5 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-inset enabled:hover:bg-[#F8F5FF] disabled:cursor-default dark:enabled:hover:bg-[#7127EA]/15',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {row.id === NO_ASSIGNEE ? (
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[#BDBDBD] text-xs text-[#909090] dark:border-border"
                      >
                        ?
                      </span>
                    ) : (
                      <EmployeeAvatar
                        name={row.name}
                        photoUrl={row.photoUrl}
                        className="size-8 shrink-0 ring-[1.6px] ring-[#DBD2FF]"
                        fallbackClassName="text-[0.625rem]"
                      />
                    )}
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-medium text-[#303030] dark:text-title">
                        {row.name}
                      </span>
                      {row.role && (
                        <span className="truncate text-xs text-[#909090]">{row.role}</span>
                      )}
                    </span>
                  </span>
                  <WorkloadBar row={row} statuses={statuses} max={max} />
                  <span className="flex flex-wrap gap-x-4 gap-y-1 @4xl/team:contents">
                    <Stat label="Open" value={String(row.open)} />
                    <Stat
                      label="Overdue"
                      value={String(row.overdue)}
                      tone={row.overdue > 0 ? 'alert' : undefined}
                    />
                    <Stat label="Due this week" value={String(row.dueThisWeek)} />
                    <Stat label="Done in 30 days" value={String(row.doneLast30)} />
                    <Stat label="Points" value={row.points === null ? '–' : String(row.points)} />
                    <Stat
                      label="Estimate"
                      value={row.estimateMinutes ? formatDuration(row.estimateMinutes) : '–'}
                    />
                  </span>
                </button>
                <span id={`team-row-${row.id}`} className="sr-only">
                  {plural(row.open, 'open task')}
                  {breakdown ? ` (${breakdown})` : ''}, {row.overdue} overdue, {row.dueThisWeek} due
                  this week, {row.doneLast30} done in the last 30 days
                  {row.points === null ? '' : `, ${plural(row.points, 'point')}`}
                  {row.estimateMinutes ? `, estimate ${formatDuration(row.estimateMinutes)}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
