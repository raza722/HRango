import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Flag } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { PRIORITY_META } from '../../constants'
import type { DashboardTask } from '../../hooks/use-dashboards'
import { usePeople } from '../../hooks/use-pm'
import { dash } from './dashboard-styles'
import { dueLabel } from './dashboard-utils'

/** Opens the task in its workspace's List view (the task screen opens from the hash). */
export function TaskLink({
  task,
  children,
  className,
}: {
  task: Pick<DashboardTask, 'id' | 'workspaceId'>
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to="/project-management/workspaces/$workspaceId"
      params={{ workspaceId: task.workspaceId }}
      hash={task.id}
      className={className}
    >
      {children}
    </Link>
  )
}

/** The status's own colour ring and name, as the List view's status chips. */
export function StatusChip({ task }: { task: DashboardTask }) {
  const color = task.status?.color ?? '#9AA1AE'
  return (
    <span className={cn(dash.chip, 'border border-[#ECECEC] text-title dark:border-border')}>
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full border-2"
        style={{ borderColor: color, background: task.done ? color : 'transparent' }}
      />
      {task.status?.name ?? 'No status'}
    </span>
  )
}

export function PriorityFlag({ task }: { task: DashboardTask }) {
  if (!task.priority) return null
  const meta = PRIORITY_META[task.priority]
  return (
    <span className="inline-flex items-center gap-1 text-xs text-grey">
      <Flag
        aria-hidden="true"
        className="size-3.5"
        style={{ color: meta.color, fill: meta.color }}
      />
      {meta.label}
    </span>
  )
}

/** "Today", "2 days overdue"…: red when overdue, amber when due today. */
export function DueChip({ task, now }: { task: DashboardTask; now: Date }) {
  const label = dueLabel(task, now)
  const tone = task.done
    ? dash.neutral
    : task.isOverdue
      ? dash.danger
      : label === 'Today'
        ? dash.warning
        : dash.neutral
  return <span className={cn(dash.chip, tone)}>{label}</span>
}

/** Up to three assignee avatars, then "+2". */
export function AvatarStack({ task, max = 3 }: { task: DashboardTask; max?: number }) {
  const people = usePeople()
  if (task.assignees.length === 0) {
    return <span className="text-xs text-grey">Unassigned</span>
  }
  const shown = task.assignees.slice(0, max)
  const rest = task.assignees.length - shown.length
  return (
    <span
      className="flex items-center -space-x-2"
      title={task.assignees.map((entry) => entry.name).join(', ')}
    >
      <span className="sr-only">
        Assigned to {task.assignees.map((entry) => entry.name).join(', ')}
      </span>
      {shown.map((entry) => (
        <EmployeeAvatar
          key={entry.employeeId}
          name={entry.name}
          photoUrl={people.get(entry.employeeId)?.photoUrl ?? null}
          className="size-7 ring-2 ring-card"
          fallbackClassName="text-[0.625rem]"
        />
      ))}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className="relative flex size-7 items-center justify-center rounded-full bg-[#F0E9FD] text-[0.625rem] font-semibold text-[#5B1FC2] ring-2 ring-card dark:bg-[#7127EA]/30 dark:text-[#E2D6FF]"
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

/** A task line: name and where it lives, then chips on the right (wrap under on a phone). */
export function TaskLine({
  task,
  meta,
  trailing,
  showWorkspace = true,
}: {
  task: DashboardTask
  meta?: ReactNode
  trailing?: ReactNode
  showWorkspace?: boolean
}) {
  const where = [showWorkspace ? task.workspaceName : null, task.listName]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <TaskLink task={task} className={cn(dash.row, 'flex-wrap sm:flex-nowrap')}>
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full border-2"
          style={{
            borderColor: task.status?.color ?? '#9AA1AE',
            background: task.done ? (task.status?.color ?? '#9AA1AE') : 'transparent',
          }}
        />
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-medium text-title">{task.name}</span>
          <span className="truncate text-xs text-grey">
            {[task.code, where].filter(Boolean).join(' · ')}
            {meta}
          </span>
        </span>
        {trailing && (
          <span className="flex w-full shrink-0 flex-wrap items-center gap-2 pl-5 sm:w-auto sm:pl-0">
            {trailing}
          </span>
        )}
      </TaskLink>
    </li>
  )
}
