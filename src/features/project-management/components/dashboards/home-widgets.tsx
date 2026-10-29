import { type ReactNode, useState } from 'react'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  Gauge,
  Inbox,
  MessageSquareText,
  UserCheck,
} from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import {
  type AssignedComment,
  type DashboardTask,
  useAssignedComments,
} from '../../hooks/use-dashboards'
import { usePeople, useUpdateComment } from '../../hooks/use-pm'
import type { ReminderEntry } from '../../types/pm.types'
import { formatDuration, formatTime12, toDay } from '../task-fields/field-utils'
import { ActivityChart } from './activity-chart'
import { Widget, WidgetEmpty, WidgetError, WidgetSkeleton } from './dashboard-parts'
import { dash } from './dashboard-styles'
import {
  activityFigures,
  activitySeries,
  whenLabel,
  WORK_BUCKET_LABELS,
  WORK_BUCKETS,
  type WorkBucket,
  workBucket,
} from './dashboard-utils'
import { DueChip, PriorityFlag, StatusChip, TaskLine, TaskLink } from './task-bits'

// --- agenda ------------------------------------------------------------------------------------------

interface AgendaItem {
  key: string
  /** `HH:mm`, or null for a task due on the day without a time. */
  time: string | null
  kind: 'task' | 'reminder'
  task: DashboardTask | null
  reminder: ReminderEntry | null
}

function agendaFor(
  day: string,
  tasks: readonly DashboardTask[],
  reminders: readonly ReminderEntry[],
): AgendaItem[] {
  const due = tasks
    .filter((task) => !task.done && task.dueDate === day)
    .map((task): AgendaItem => ({
      key: `task:${task.id}`,
      time: task.dueTime,
      kind: 'task',
      task,
      reminder: null,
    }))
  const reminding = reminders
    .filter((reminder) => toDay(parseISO(reminder.remindAt)) === day)
    .map((reminder): AgendaItem => ({
      key: `reminder:${reminder.id}`,
      time: format(parseISO(reminder.remindAt), 'HH:mm'),
      kind: 'reminder',
      task: null,
      reminder,
    }))
  return [...due, ...reminding].toSorted((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
}

/**
 * Agenda: the next seven days as a strip (how many things each day holds); the chosen day lists
 * the caller's open tasks due then and their reminders, by time.
 */
export function AgendaWidget({
  tasks,
  reminders,
  className,
}: {
  tasks: readonly DashboardTask[]
  reminders: readonly ReminderEntry[]
  className?: string
}) {
  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index))
  const [chosen, setChosen] = useState(() => toDay(today))
  const items = agendaFor(chosen, tasks, reminders)
  const chosenDate = parseISO(chosen)

  return (
    <Widget
      title="Agenda"
      icon={<CalendarDays />}
      description="Your tasks due and reminders over the next seven days."
      className={className}
    >
      <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1.5">
        {days.map((date, index) => {
          const day = toDay(date)
          const count = agendaFor(day, tasks, reminders).length
          const pressed = day === chosen
          return (
            <button
              key={day}
              type="button"
              aria-pressed={pressed}
              aria-label={`${format(date, 'EEEE d MMMM')}: ${String(count)} ${count === 1 ? 'item' : 'items'}`}
              onClick={() => {
                setChosen(day)
              }}
              className={cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-[0.75rem] border py-2 transition-colors',
                dash.focus,
                pressed
                  ? 'border-[#7127EA] bg-[#7127EA] text-white dark:border-[#9F7BF3] dark:bg-[#7127EA]'
                  : 'border-[#ECECEC] text-title hover:border-[#D9C8FB] hover:bg-[#FCFAFF] dark:border-border dark:hover:bg-white/[0.03]',
              )}
            >
              <span
                className={cn(
                  'text-[0.625rem] font-medium uppercase',
                  pressed ? 'text-white/85' : 'text-grey',
                )}
              >
                {index === 0 ? 'Today' : format(date, 'EEE')}
              </span>
              <span className="text-base leading-tight font-semibold">{format(date, 'd')}</span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(3, count) }, (_, dot) => (
                  <span
                    key={dot}
                    className={cn(
                      'size-1.5 rounded-full',
                      pressed ? 'bg-white' : 'bg-[#7127EA] dark:bg-[#C4ABFF]',
                    )}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <WidgetEmpty icon={<CalendarDays />} title={`Nothing on ${format(chosenDate, 'EEEE')}`}>
            No task of yours is due and no reminder is set for {format(chosenDate, 'd MMMM')}.
          </WidgetEmpty>
        ) : (
          <ol aria-label={`Agenda for ${format(chosenDate, 'EEEE d MMMM')}`} className="grid gap-2">
            {items.map((item) => (
              <li
                key={item.key}
                className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-3"
              >
                <span className="pt-2.5 text-right text-xs font-semibold text-grey tabular-nums">
                  {item.time ? formatTime12(item.time) : 'All day'}
                </span>
                {item.task ? (
                  <TaskLink
                    task={item.task}
                    className={cn(
                      dash.row,
                      'border-l-[3px] border-l-[#7127EA] bg-[#F8F5FF] dark:border-l-[#9F7BF3] dark:bg-[#7127EA]/10',
                    )}
                  >
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-title">
                        {item.task.name}
                      </span>
                      <span className="truncate text-xs text-grey">
                        Due · {item.task.workspaceName}
                      </span>
                    </span>
                    <PriorityFlag task={item.task} />
                  </TaskLink>
                ) : item.reminder ? (
                  <ReminderLine reminder={item.reminder} />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Widget>
  )
}

function ReminderLine({ reminder }: { reminder: ReminderEntry }) {
  const body = (
    <>
      <Bell aria-hidden="true" className="size-4 shrink-0 text-[#F79009]" />
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-title">{reminder.name}</span>
        <span className="truncate text-xs text-grey">Reminder</span>
      </span>
    </>
  )
  const frame = cn(dash.row, 'border-l-[3px] border-l-[#F79009] bg-[#FFF8EC] dark:bg-[#F79009]/10')
  if (reminder.entityType !== 'task') return <div className={frame}>{body}</div>
  return (
    <TaskLink task={{ id: reminder.entityId, workspaceId: reminder.workspaceId }} className={frame}>
      {body}
    </TaskLink>
  )
}

// --- my work -----------------------------------------------------------------------------------------

const OPEN_BY_DEFAULT: ReadonlySet<WorkBucket> = new Set(['overdue', 'today', 'next'])

/** My Work: the caller's open tasks by when they are due, overdue first. */
export function MyWorkWidget({
  tasks,
  className,
}: {
  tasks: readonly DashboardTask[]
  className?: string
}) {
  const now = new Date()
  const open = tasks.filter((task) => !task.done)
  const [expanded, setExpanded] = useState<ReadonlySet<WorkBucket>>(OPEN_BY_DEFAULT)
  const toggle = (bucket: WorkBucket) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

  return (
    <Widget
      title="My Work"
      icon={<BriefcaseBusiness />}
      description="Your open tasks across your workspaces, by due date."
      count={open.length}
      className={className}
    >
      {open.length === 0 ? (
        <WidgetEmpty icon={<CircleCheckBig />} title="All clear">
          No open task is assigned to you.
        </WidgetEmpty>
      ) : (
        <div className="grid gap-2">
          {WORK_BUCKETS.map((bucket) => {
            const items = open
              .filter((task) => workBucket(task, now) === bucket)
              .toSorted((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
            if (items.length === 0) return null
            const isOpen = expanded.has(bucket)
            const panelId = `my-work-${bucket}`
            return (
              <div
                key={bucket}
                className="rounded-[0.75rem] border border-[#F0F0F0] dark:border-white/5"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => {
                    toggle(bucket)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.75rem] px-3 py-2.5 text-left',
                    dash.focus,
                  )}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-4 text-[#7127EA] transition-transform',
                      !isOpen && '-rotate-90',
                    )}
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm font-semibold',
                      bucket === 'overdue' ? 'text-[#B7192C] dark:text-[#FF9AA3]' : 'text-title',
                    )}
                  >
                    {WORK_BUCKET_LABELS[bucket]}
                  </span>
                  <span
                    className={cn(dash.chip, bucket === 'overdue' ? dash.danger : dash.neutral)}
                  >
                    {items.length}
                  </span>
                </button>
                {isOpen && (
                  <ul id={panelId} className="grid gap-0.5 px-1 pb-1.5">
                    {items.map((task) => (
                      <TaskLine
                        key={task.id}
                        task={task}
                        trailing={
                          <>
                            <PriorityFlag task={task} />
                            <DueChip task={task} now={now} />
                          </>
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Widget>
  )
}

// --- assigned to me ----------------------------------------------------------------------------------

const ASSIGNED_FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
] as const
type AssignedFilter = (typeof ASSIGNED_FILTERS)[number]['key']

/** Assigned to Me: every task the caller is assigned, with status and priority. */
export function AssignedToMeWidget({
  tasks,
  className,
}: {
  tasks: readonly DashboardTask[]
  className?: string
}) {
  const now = new Date()
  const [filter, setFilter] = useState<AssignedFilter>('open')
  const [all, setAll] = useState(false)
  const shownTasks = tasks
    .filter((task) => filter === 'all' || (filter === 'done' ? task.done : !task.done))
    .toSorted(
      (a, b) =>
        Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    )
  const visible = all ? shownTasks : shownTasks.slice(0, 6)

  return (
    <Widget
      title="Assigned to Me"
      icon={<UserCheck />}
      description="Everything you are assigned, wherever it lives."
      count={tasks.filter((task) => !task.done).length}
      action={
        <div role="group" aria-label="Show" className={dash.segmentGroup}>
          {ASSIGNED_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => {
                setFilter(option.key)
                setAll(false)
              }}
              className={dash.segment}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
      className={className}
    >
      {shownTasks.length === 0 ? (
        <WidgetEmpty
          icon={<Inbox />}
          title={filter === 'done' ? 'Nothing done yet' : 'Nothing here'}
        >
          {filter === 'done'
            ? 'Tasks of yours that are completed show here.'
            : 'No open task is assigned to you.'}
        </WidgetEmpty>
      ) : (
        <div className="grid gap-2">
          <ul className="grid gap-0.5">
            {visible.map((task) => (
              <TaskLine
                key={task.id}
                task={task}
                trailing={
                  <>
                    <StatusChip task={task} />
                    <DueChip task={task} now={now} />
                  </>
                }
              />
            ))}
          </ul>
          {shownTasks.length > 6 && (
            <button
              type="button"
              aria-expanded={all}
              onClick={() => {
                setAll((value) => !value)
              }}
              className={cn(dash.ghost, 'justify-self-start')}
            >
              {all ? 'Show fewer' : `Show all ${String(shownTasks.length)}`}
            </button>
          )}
        </div>
      )}
    </Widget>
  )
}

// --- assigned comments --------------------------------------------------------------------------------

function CommentCard({ item }: { item: AssignedComment }) {
  const people = usePeople()
  const update = useUpdateComment()
  const { comment, task } = item
  const by = comment.assignedByName ?? comment.authorName
  const byId = comment.assignedById ?? comment.authorId
  return (
    <li className="grid gap-2.5 rounded-[0.75rem] border border-[#F0F0F0] p-3 dark:border-white/5">
      <div className="flex items-start gap-2.5">
        <EmployeeAvatar
          name={by}
          photoUrl={people.get(byId)?.photoUrl ?? null}
          className="size-8"
          fallbackClassName="text-[0.625rem]"
        />
        <div className="grid min-w-0 flex-1">
          <p className="text-sm text-title">
            <span className="font-semibold">{by}</span> assigned you a comment
          </p>
          <p className="truncate text-xs text-grey">
            on{' '}
            <TaskLink task={task} className={dash.link}>
              {task.name}
            </TaskLink>{' '}
            · {whenLabel(comment.createdAt, new Date())}
          </p>
        </div>
      </div>
      <p className="line-clamp-3 rounded-[0.5rem] bg-[#F8F5FF] px-3 py-2 text-sm text-title dark:bg-[#7127EA]/10">
        {comment.body}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => {
            update.mutate({
              comment,
              patch: { resolved: true },
              context: { people: [], tasks: [] },
            })
          }}
          aria-label={`Resolve the comment from ${by} on ${task.name}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7127EA] px-3 text-xs font-semibold text-white transition-colors outline-none hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] disabled:opacity-60"
        >
          <CircleCheckBig aria-hidden="true" className="size-3.5" />
          Resolve
        </button>
        <TaskLink task={task} className={dash.ghost}>
          Open task
        </TaskLink>
      </div>
    </li>
  )
}

/** Assigned Comments: open comments someone assigned to the caller. */
export function AssignedCommentsWidget({
  tasks,
  className,
}: {
  tasks: readonly DashboardTask[]
  className?: string
}) {
  const result = useAssignedComments(tasks)
  let body: ReactNode
  if (result.isPending) body = <WidgetSkeleton rows={2} />
  else if (result.error && result.comments.length === 0)
    body = <WidgetError message={result.error.message} onRetry={result.refetch} />
  else if (result.comments.length === 0)
    body = (
      <WidgetEmpty icon={<MessageSquareText />} title="No comments for you">
        When someone assigns you a comment on a task, it waits here until you resolve it.
      </WidgetEmpty>
    )
  else
    body = (
      <ul className="grid gap-2.5">
        {result.comments.map((item) => (
          <CommentCard key={item.comment.id} item={item} />
        ))}
      </ul>
    )
  return (
    <Widget
      title="Assigned Comments"
      icon={<MessageSquareText />}
      description="Comments assigned to you that are not resolved."
      count={result.isPending ? undefined : result.comments.length}
      className={className}
    >
      {body}
    </Widget>
  )
}

// --- activity KPI ------------------------------------------------------------------------------------

function Figure({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div className="grid gap-0.5 rounded-[0.75rem] bg-[#F8F5FF] px-3 py-2.5 dark:bg-white/[0.04]">
      <dt className="text-xs text-grey">{label}</dt>
      <dd className="text-xl font-semibold text-title">{value}</dd>
      {children}
    </div>
  )
}

function WeekDelta({ now, before }: { now: number; before: number }) {
  if (now === before) return <dd className="text-xs text-grey">Same as last week</dd>
  const up = now > before
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <dd
      className={cn(
        'flex items-center gap-0.5 text-xs',
        up ? 'text-[#1E7B3A] dark:text-emerald-300' : 'text-[#B7192C] dark:text-[#FF9AA3]',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {up ? '+' : '−'}
      {Math.abs(now - before)} vs last week
    </dd>
  )
}

/**
 * Activity KPI: completed this week (against last week), the share closed on time, time tracked
 * and story points, then tasks due and completed per day over two weeks. "Mine" counts the
 * caller's tasks; "Team" every task in their workspaces.
 */
export function ActivityKpiWidget({
  mine,
  team,
  meId,
  className,
}: {
  mine: readonly DashboardTask[]
  team: readonly DashboardTask[]
  meId: string | null
  className?: string
}) {
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const now = new Date()
  const tasks = scope === 'mine' ? mine : team
  const figures = activityFigures(tasks, now, scope === 'mine' ? meId : null)
  const days = activitySeries(tasks, now)

  return (
    <Widget
      title="Activity KPI"
      icon={<Gauge />}
      description="Delivery over the last two weeks."
      action={
        <div role="group" aria-label="Whose tasks" className={dash.segmentGroup}>
          {(
            [
              ['mine', 'Mine'],
              ['team', 'Team'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={scope === key}
              onClick={() => {
                setScope(key)
              }}
              className={dash.segment}
            >
              {label}
            </button>
          ))}
        </div>
      }
      className={className}
    >
      <div className="grid gap-4">
        <dl className="grid grid-cols-2 gap-2 @3xl/page:grid-cols-4">
          <Figure label="Done this week" value={String(figures.completedThisWeek)}>
            <WeekDelta now={figures.completedThisWeek} before={figures.completedLastWeek} />
          </Figure>
          <Figure
            label="Closed on time"
            value={figures.onTimePercent === null ? '—' : `${String(figures.onTimePercent)}%`}
          />
          <Figure
            label="Time tracked"
            value={figures.trackedMinutes === 0 ? '0hr' : formatDuration(figures.trackedMinutes)}
          />
          <Figure label="Story points" value={String(figures.storyPoints)} />
        </dl>
        <ActivityChart
          title={`${scope === 'mine' ? 'Your' : 'Team'} tasks due and completed per day, last 14 days`}
          days={days}
        />
      </div>
    </Widget>
  )
}
