import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  format,
  isToday,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { PmAccess } from '../../hooks/use-pm-access'
import type { TaskRow, Workspace, WorkspaceTree } from '../../types/pm.types'
import { formatCellDate, fromDay } from '../task-fields/field-utils'
import { TaskPeek } from './task-peek'
import { useTaskActions } from './use-task-actions'

export type TimelineScale = 'week' | 'month' | 'quarter'
export type TimelineGroup = 'list' | 'assignee' | 'status'

const toDay = (date: Date) => format(date, 'yyyy-MM-dd')
/** Pixels per day at each scale. */
const DAY_PX: Record<TimelineScale, number> = { week: 56, month: 32, quarter: 10 }
const SCALE_LABELS: Record<TimelineScale, string> = {
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
}
const GROUP_LABELS: Record<TimelineGroup, string> = {
  list: 'List',
  assignee: 'Assignee',
  status: 'Status',
}

/** The days a scale shows around `anchor`: two weeks, the month, or the quarter. */
function windowOf(scale: TimelineScale, anchor: Date) {
  if (scale === 'week') {
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 13) }
  }
  if (scale === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) }
}

/** A task's span: start to due, or the one date it has. */
const spanOf = (task: TaskRow) => {
  const start = task.startDate ?? task.dueDate
  const end = task.dueDate ?? task.startDate
  return start && end ? { start, end } : null
}

type Grip = 'move' | 'start' | 'end'

/** The dates after dragging a bar (or a grip) by `shift` days; the span never turns inside out. */
function shifted(task: TaskRow, grip: Grip, shift: number) {
  const span = spanOf(task)
  if (!span) return { startDate: task.startDate, dueDate: task.dueDate }
  const move = (day: string) => toDay(addDays(fromDay(day), shift))
  if (grip === 'move') {
    return {
      startDate: task.startDate ? move(task.startDate) : null,
      dueDate: task.dueDate ? move(task.dueDate) : null,
    }
  }
  if (grip === 'start') {
    const start = move(span.start)
    return { startDate: start > span.end ? span.end : start, dueDate: task.dueDate ?? span.end }
  }
  const end = move(span.end)
  return { startDate: task.startDate ?? span.start, dueDate: end < span.start ? span.start : end }
}

interface Group {
  key: string
  name: string
  tasks: TaskRow[]
}

function groupTasks(tasks: readonly TaskRow[], by: TimelineGroup, workspace: Workspace): Group[] {
  const groups = new Map<string, Group>()
  const add = (key: string, name: string, task: TaskRow) => {
    const group = groups.get(key) ?? { key, name, tasks: [] }
    group.tasks.push(task)
    groups.set(key, group)
  }
  for (const task of tasks) {
    if (by === 'status') {
      const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)
      add(task.statusId, status?.name ?? 'Other', task)
    } else if (by === 'assignee') {
      if (task.assignees.length === 0) add('~none', 'Unassigned', task)
      for (const entry of task.assignees) add(entry.employeeId, entry.name, task)
    } else {
      add(task.listId ?? '~none', task.listName ?? 'Not in a list', task)
    }
  }
  const list = [...groups.values()]
  if (by === 'status') {
    const order = workspace.setup.statuses.map((status) => status.id)
    return list.toSorted((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }
  // Alphabetical, with "Unassigned" / "Not in a list" last.
  return list.toSorted((a, b) =>
    a.key === '~none' ? 1 : b.key === '~none' ? -1 : a.name.localeCompare(b.name),
  )
}

/** One task's bar: drag it to move both dates, a grip to move one; arrows move it by a day. */
function Bar({
  task,
  windowStart,
  windowDays,
  dayPx,
  workspace,
  tasks,
  access,
  onDates,
  onOpenTask,
}: {
  task: TaskRow
  windowStart: Date
  windowDays: number
  dayPx: number
  workspace: Workspace
  tasks: readonly TaskRow[]
  access: PmAccess
  onDates: (task: TaskRow, dates: { startDate: string | null; dueDate: string | null }) => void
  onOpenTask: (task: TaskRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<{ grip: Grip; x: number; shift: number } | null>(null)
  // A drag ends with a click: it must not open the task.
  const dragged = useRef(false)
  const span = spanOf(task)
  if (!span) return null
  const preview = drag ? shifted(task, drag.grip, drag.shift) : null
  const shownSpan = preview ? (spanOf({ ...task, ...preview }) ?? span) : span
  const from = differenceInCalendarDays(fromDay(shownSpan.start), windowStart)
  const to = differenceInCalendarDays(fromDay(shownSpan.end), windowStart)
  const left = Math.max(0, from)
  const right = Math.min(windowDays - 1, to)
  if (right < 0 || left > windowDays - 1) return null
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)
  const color = status?.color ?? '#909090'
  const editable = access.editTasks

  const start = (grip: Grip) => (event: PointerEvent<HTMLElement>) => {
    if (!editable || event.button !== 0) return
    event.stopPropagation()
    // The bar keeps the pointer while it is dragged (jsdom and some old browsers lack it).
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Without capture the drag still works while the pointer stays over the bar.
    }
    dragged.current = false
    setDrag({ grip, x: event.clientX, shift: 0 })
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return
    const shift = Math.round((event.clientX - drag.x) / dayPx)
    if (shift !== drag.shift) {
      dragged.current = true
      setDrag({ ...drag, shift })
    }
  }
  const end = () => {
    if (drag && drag.shift !== 0) onDates(task, shifted(task, drag.grip, drag.shift))
    setDrag(null)
  }
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editable) return
    const shift = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!shift) return
    event.preventDefault()
    onDates(task, shifted(task, event.shiftKey ? 'end' : 'move', shift))
  }
  const range =
    span.start === span.end
      ? formatCellDate(span.start)
      : `${formatCellDate(span.start)} to ${formatCellDate(span.end)}`

  return (
    <TaskPeek
      task={task}
      workspace={workspace}
      tasks={tasks}
      access={access}
      open={open}
      onOpenChange={setOpen}
      onOpenTask={onOpenTask}
      trigger={
        <button
          type="button"
          aria-label={`${task.name}, ${range}${task.isOverdue ? ', overdue' : ''}`}
          title={
            editable
              ? 'Drag to move, drag an end to change one date; arrow keys move it a day (Shift: the due date only)'
              : range
          }
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={() => {
            setDrag(null)
          }}
          onClick={(event) => {
            if (dragged.current) {
              event.preventDefault()
              dragged.current = false
            }
          }}
          onKeyDown={onKey}
          className={cn(
            'absolute top-1.5 flex h-7 touch-none items-center overflow-hidden border text-left text-xs font-medium whitespace-nowrap text-[#303030] outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title',
            from >= 0 ? 'rounded-l-md' : 'border-l-0',
            to <= windowDays - 1 ? 'rounded-r-md' : 'border-r-0',
            editable && (drag ? 'cursor-grabbing' : 'cursor-grab'),
            task.isOverdue && 'ring-1 ring-[#DC3545]',
          )}
          style={{
            left: left * dayPx + 2,
            width: Math.max(dayPx - 4, (right - left + 1) * dayPx - 4),
            backgroundColor: `${color}26`,
            borderColor: color,
          }}
        >
          {editable && from >= 0 && (
            <span
              aria-hidden="true"
              onPointerDown={start('start')}
              className="h-full w-2 shrink-0 cursor-ew-resize"
            />
          )}
          <span className="min-w-0 flex-1 truncate px-1">{task.name}</span>
          {editable && to <= windowDays - 1 && (
            <span
              aria-hidden="true"
              onPointerDown={start('end')}
              className="h-full w-2 shrink-0 cursor-ew-resize"
            />
          )}
        </button>
      }
    />
  )
}

/**
 * The Timeline view (not drawn; approved layout): a bar per task from its start to its due date
 * (one day when it has only one), grouped by list, assignee or status, over two weeks, a month
 * or a quarter, with a line for today. Drag a bar to move both dates, its ends to change one;
 * arrow keys do the same; a bar opens the task with its date cells. Tasks with no dates are
 * listed last. Search and Filters apply.
 */
export function TimelineView({
  workspace,
  tree,
  listId,
  tasks,
  visibleTasks,
  access,
  on,
  scale,
  group,
  onSearch,
  onOpenTask,
}: {
  workspace: Workspace
  tree: WorkspaceTree
  listId: string | null
  tasks: readonly TaskRow[]
  visibleTasks: readonly TaskRow[]
  access: PmAccess
  on: string | undefined
  scale: TimelineScale
  group: TimelineGroup
  onSearch: (patch: {
    on?: string | undefined
    scale?: TimelineScale | undefined
    group?: TimelineGroup | undefined
  }) => void
  onOpenTask: (task: TaskRow) => void
}) {
  const actions = useTaskActions({ workspace, tree, listId, tasks })
  const anchor = on ? parseISO(on) : new Date()
  const { start, end } = windowOf(scale, anchor)
  const days = eachDayOfInterval({ start, end })
  const dayPx = DAY_PX[scale]
  const width = days.length * dayPx
  const today = differenceInCalendarDays(new Date(), start)
  const step = (direction: 1 | -1) => {
    const next =
      scale === 'week'
        ? addWeeks(anchor, 2 * direction)
        : scale === 'month'
          ? addMonths(anchor, direction)
          : addQuarters(anchor, direction)
    onSearch({ on: toDay(next) })
  }
  const title =
    scale === 'month'
      ? format(start, 'MMMM yyyy')
      : `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`

  const first = toDay(start)
  const last = toDay(end)
  const scheduled = visibleTasks
    .filter((task) => spanOf(task) !== null)
    .toSorted((a, b) => (spanOf(a)?.start ?? '').localeCompare(spanOf(b)?.start ?? ''))
  const inWindow = scheduled.filter((task) => {
    const span = spanOf(task)
    return span !== null && span.end >= first && span.start <= last
  })
  const outside = scheduled.length - inWindow.length
  const undated = visibleTasks.filter((task) => spanOf(task) === null && task.closedAt === null)
  const groups = groupTasks(inWindow, group, workspace)
  // Day ticks: every day (two weeks, month), or each week's first day (quarter).
  const ticks = days
    .map((date, index) => ({ date, index }))
    .filter(({ date, index }) => scale !== 'quarter' || index === 0 || date.getDay() === 0)

  const nameCell = 'sticky left-0 z-[2] w-36 shrink-0 bg-white dark:bg-card px-3 sm:w-60'
  const track = (children?: ReactNode) => (
    <div className="relative h-10 shrink-0" style={{ width }}>
      {today >= 0 && today < days.length && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-[#DC3545]"
          style={{ left: today * dayPx + dayPx / 2 }}
        />
      )}
      {children}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 dark:bg-card">
        <button
          type="button"
          aria-label="Earlier"
          onClick={() => {
            step(-1)
          }}
          className="inline-flex size-10 items-center justify-center rounded-xl text-[#5D5D5D] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title dark:hover:bg-[#7127EA]/15"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            onSearch({ on: undefined })
          }}
          className="h-10 rounded-xl px-3 text-sm font-semibold text-[#3D3D3D] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title dark:hover:bg-[#7127EA]/15"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Later"
          onClick={() => {
            step(1)
          }}
          className="inline-flex size-10 items-center justify-center rounded-xl text-[#5D5D5D] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title dark:hover:bg-[#7127EA]/15"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        <h2
          className="px-2 text-lg font-semibold text-[#303030] dark:text-title"
          aria-live="polite"
        >
          {title}
        </h2>
        <label className="ml-auto flex items-center gap-2 text-sm text-[#626262] dark:text-title">
          Group by
          <select
            value={group}
            onChange={(event) => {
              const next = event.target.value as TimelineGroup
              onSearch({ group: next === 'list' ? undefined : next })
            }}
            className="h-9 rounded-lg border border-[#E9E9E9] bg-white px-2 text-sm text-[#303030] outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:border-border dark:bg-card dark:text-title"
          >
            {(Object.keys(GROUP_LABELS) as TimelineGroup[]).map((value) => (
              <option key={value} value={value}>
                {GROUP_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div
          role="group"
          aria-label="Scale"
          className="flex rounded-xl bg-[#F8F8F8] p-1 dark:bg-white/5"
        >
          {(Object.keys(SCALE_LABELS) as TimelineScale[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scale === value}
              onClick={() => {
                onSearch({ scale: value === 'month' ? undefined : value })
              }}
              className={cn(
                'h-8 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                scale === value
                  ? 'bg-white text-[#7127EA] shadow-xs dark:bg-card dark:text-[#C4ABFF]'
                  : 'text-[#626262] dark:text-title',
              )}
            >
              {SCALE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-[0.875rem] border border-[#ECECEC] bg-white dark:border-border dark:bg-card">
        <div role="table" aria-label={`Timeline, ${title}`} className="w-max min-w-full">
          <div role="row" className="flex border-b border-[#ECECEC] dark:border-border">
            <span
              role="columnheader"
              className={cn(
                nameCell,
                'flex h-10 items-center text-sm font-semibold text-[#626262] dark:text-title',
              )}
            >
              Task
            </span>
            <span role="columnheader" className="relative h-10 shrink-0" style={{ width }}>
              <span className="sr-only">Dates</span>
              {ticks.map(({ date, index }) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0 flex h-full items-center border-l border-[#F2F2F2] pl-1 text-[0.6875rem] whitespace-nowrap dark:border-border',
                    isToday(date)
                      ? 'font-semibold text-[#DC3545] dark:text-[#FF8A94]'
                      : 'text-[#909090]',
                  )}
                  style={{ left: index * dayPx }}
                >
                  {scale === 'week'
                    ? format(date, 'EEE d')
                    : scale === 'month'
                      ? format(date, 'd')
                      : format(date, 'd MMM')}
                </span>
              ))}
            </span>
          </div>

          {groups.length === 0 && (
            <div role="row" className="flex">
              <span
                role="cell"
                className="sticky left-0 px-3 py-8 text-sm text-[#707070] dark:text-grey"
              >
                No task has dates in this range
                {outside > 0 ? `; ${String(outside)} fall outside it` : ''}.
              </span>
            </div>
          )}
          {groups.map((entry) => (
            <div key={entry.key} role="rowgroup" aria-label={entry.name}>
              <div role="row" className="flex bg-[#FAFAFA] dark:bg-white/5">
                <span
                  role="rowheader"
                  className={cn(
                    nameCell,
                    'flex h-9 min-w-0 items-center bg-[#FAFAFA] text-sm font-semibold text-[#4A4A4A] dark:bg-white/5 dark:text-title',
                  )}
                >
                  <span className="truncate" title={entry.name}>
                    {entry.name}
                  </span>
                  <span className="ml-1 shrink-0 font-normal text-[#909090]">
                    ({entry.tasks.length})
                  </span>
                </span>
                <span role="cell" className="shrink-0" style={{ width }} />
              </div>
              {entry.tasks.map((task) => (
                <div
                  key={`${entry.key}-${task.id}`}
                  role="row"
                  className="flex border-t border-[#F2F2F2] dark:border-border"
                >
                  <span
                    role="rowheader"
                    className={cn(
                      nameCell,
                      'flex h-10 min-w-0 items-center text-sm text-[#303030] dark:text-title',
                    )}
                  >
                    <span className="truncate" title={task.name}>
                      {task.name}
                    </span>
                  </span>
                  <span role="cell" className="shrink-0">
                    {track(
                      <Bar
                        task={task}
                        windowStart={start}
                        windowDays={days.length}
                        dayPx={dayPx}
                        workspace={workspace}
                        tasks={tasks}
                        access={access}
                        onDates={actions.setDates}
                        onOpenTask={onOpenTask}
                      />,
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {outside > 0 && groups.length > 0 && (
        <p className="text-xs text-[#707070] dark:text-grey">
          {outside} more task{outside === 1 ? ' has' : 's have'} dates outside this range.
        </p>
      )}
      <section
        aria-labelledby="timeline-undated"
        className="grid gap-2 rounded-xl bg-white p-3 dark:bg-card"
      >
        <h3 id="timeline-undated" className="text-sm font-semibold text-[#303030] dark:text-title">
          Unscheduled ({undated.length})
        </h3>
        {undated.length === 0 ? (
          <p className="text-xs text-[#909090]">Every open task has dates.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {undated.map((task) => (
              <li key={task.id}>
                <UndatedChip
                  task={task}
                  workspace={workspace}
                  tasks={tasks}
                  access={access}
                  onOpenTask={onOpenTask}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** A task with no dates: open it to give it some. */
function UndatedChip({
  task,
  workspace,
  tasks,
  access,
  onOpenTask,
}: {
  task: TaskRow
  workspace: Workspace
  tasks: readonly TaskRow[]
  access: PmAccess
  onOpenTask: (task: TaskRow) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <TaskPeek
      task={task}
      workspace={workspace}
      tasks={tasks}
      access={access}
      open={open}
      onOpenChange={setOpen}
      onOpenTask={onOpenTask}
      trigger={
        <button
          type="button"
          className="rounded-md border border-[#ECECEC] px-2 py-1 text-xs font-medium text-[#303030] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:border-border dark:text-title dark:hover:bg-[#7127EA]/15"
        >
          {task.name}
        </button>
      }
    />
  )
}
