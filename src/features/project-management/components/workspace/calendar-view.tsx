import { useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import type { PmAccess } from '../../hooks/use-pm-access'
import type { TaskRow, Workspace, WorkspaceTree } from '../../types/pm.types'
import { fromDay } from '../task-fields/field-utils'
import { TaskPeek } from './task-peek'
import { useTaskActions } from './use-task-actions'
import { MilestoneIcon } from './workspace-icons'

export type CalendarMode = 'month' | 'week'

const toDay = (date: Date) => format(date, 'yyyy-MM-dd')
/** A month cell shows this many tasks, then "+n more" (which opens that week). */
const MONTH_CELL_TASKS = 3

const navButton =
  'inline-flex size-10 items-center justify-center rounded-xl text-[#5D5D5D] dark:text-title outline-none hover:bg-[#F8F5FF] dark:hover:bg-[#7127EA]/15 focus-visible:ring-2 focus-visible:ring-[#A181FF]'

/**
 * The new dates of a task moved to `day`: the due date goes there and a start date keeps its
 * distance; a task with a start and no due date gets the day as its due date (its start stays,
 * or moves to the day if it was later).
 */
function datesOn(task: TaskRow, day: string) {
  if (task.dueDate) {
    const shift = differenceInCalendarDays(fromDay(day), fromDay(task.dueDate))
    return {
      dueDate: day,
      startDate: task.startDate ? toDay(addDays(fromDay(task.startDate), shift)) : null,
    }
  }
  return {
    dueDate: day,
    startDate:
      task.startDate && task.startDate <= day ? task.startDate : task.startDate ? day : null,
  }
}

/** A task on the calendar: drag it to another day; click it to see it and change its dates. */
function CalendarChip({
  task,
  workspace,
  tasks,
  access,
  onDragging,
  onOpenTask,
}: {
  task: TaskRow
  workspace: Workspace
  tasks: readonly TaskRow[]
  access: PmAccess
  onDragging: (taskId: string | null) => void
  onOpenTask: (task: TaskRow) => void
}) {
  const [open, setOpen] = useState(false)
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)
  const closed = task.closedAt !== null
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
          draggable={access.editTasks}
          onDragStart={(event) => {
            const transfer = event.dataTransfer as DataTransfer | null
            transfer?.setData('text/plain', task.id)
            onDragging(task.id)
          }}
          onDragEnd={() => {
            onDragging(null)
          }}
          className={cn(
            'flex w-full min-w-0 items-center gap-1.5 rounded-md border border-l-[3px] border-[#ECECEC] bg-white px-1.5 py-1 text-left text-xs leading-tight font-medium outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:border-border dark:bg-card dark:hover:bg-[#7127EA]/15',
            task.isOverdue
              ? 'text-[#B7192C] dark:text-[#FF9AA3]'
              : 'text-[#303030] dark:text-title',
            closed && 'text-[#909090] line-through',
            access.editTasks && 'cursor-grab active:cursor-grabbing',
          )}
          style={{ borderLeftColor: status?.color ?? '#909090' }}
        >
          {task.type === 'milestone' && <MilestoneIcon className="size-3 shrink-0" />}
          <span className="min-w-0 truncate">{task.name}</span>
          {task.isOverdue && <span className="sr-only">, overdue</span>}
        </button>
      }
    />
  )
}

/**
 * The Calendar view (not drawn; approved layout): the tasks on their due date, a month (weeks
 * from Sunday, as the List view's date picker) or a week. Drag a task to another day to move its
 * due date (its start date keeps its distance), or onto a day from Unscheduled to give it one;
 * a task's chip opens it with its date cells (the keyboard's way). "+n more" opens that week. On
 * a phone it is a list of the days that have tasks. Search and Filters apply.
 */
export function CalendarView({
  workspace,
  tree,
  listId,
  tasks,
  visibleTasks,
  access,
  on,
  mode,
  onSearch,
  onOpenTask,
}: {
  workspace: Workspace
  tree: WorkspaceTree
  listId: string | null
  tasks: readonly TaskRow[]
  visibleTasks: readonly TaskRow[]
  access: PmAccess
  /** The day shown (`yyyy-MM-dd`); today when absent. */
  on: string | undefined
  mode: CalendarMode
  onSearch: (patch: { on?: string | undefined; calendar?: CalendarMode | undefined }) => void
  onOpenTask: (task: TaskRow) => void
}) {
  const actions = useTaskActions({ workspace, tree, listId, tasks })
  const wide = useMediaQuery(BREAKPOINTS.sm)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const anchor = on ? parseISO(on) : new Date()
  const first = mode === 'month' ? startOfWeek(startOfMonth(anchor)) : startOfWeek(anchor)
  const last = mode === 'month' ? endOfWeek(endOfMonth(anchor)) : endOfWeek(anchor)
  const days = eachDayOfInterval({ start: first, end: last })
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  )
  const title =
    mode === 'month'
      ? format(anchor, 'MMMM yyyy')
      : `${format(first, 'd MMM')} – ${format(last, 'd MMM yyyy')}`

  const byDay = new Map<string, TaskRow[]>()
  for (const task of visibleTasks) {
    if (!task.dueDate) continue
    byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task])
  }
  const unscheduled = visibleTasks.filter((task) => !task.dueDate && task.closedAt === null)
  const step = (direction: 1 | -1) => {
    const next = mode === 'month' ? addMonths(anchor, direction) : addWeeks(anchor, direction)
    onSearch({ on: toDay(next) })
  }

  const drop = (day: string) => {
    const task = tasks.find((entry) => entry.id === dragging)
    setDragging(null)
    setOver(null)
    if (task) actions.setDates(task, datesOn(task, day))
  }
  const chip = (task: TaskRow) => (
    <li key={task.id} className="min-w-0">
      <CalendarChip
        task={task}
        workspace={workspace}
        tasks={tasks}
        access={access}
        onDragging={setDragging}
        onOpenTask={onOpenTask}
      />
    </li>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 dark:bg-card">
        <button
          type="button"
          aria-label={`Previous ${mode}`}
          onClick={() => {
            step(-1)
          }}
          className={navButton}
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
          aria-label={`Next ${mode}`}
          onClick={() => {
            step(1)
          }}
          className={navButton}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        <h2
          className="px-2 text-lg font-semibold text-[#303030] dark:text-title"
          aria-live="polite"
        >
          {title}
        </h2>
        <div
          role="group"
          aria-label="Show"
          className="ml-auto flex rounded-xl bg-[#F8F8F8] p-1 dark:bg-white/5"
        >
          {(['month', 'week'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                onSearch({ calendar: value === 'month' ? undefined : value })
              }}
              className={cn(
                'h-8 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                mode === value
                  ? 'bg-white text-[#7127EA] shadow-xs dark:bg-card dark:text-[#C4ABFF]'
                  : 'text-[#626262] dark:text-title',
              )}
            >
              {value === 'month' ? 'Month' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        {wide ? (
          <table className="w-full table-fixed border-separate border-spacing-1">
            <caption className="sr-only">Tasks by due date, {title}</caption>
            <thead>
              <tr>
                {weeks[0]?.map((day) => (
                  <th
                    key={day.toISOString()}
                    scope="col"
                    className="pb-1 text-left text-xs font-semibold text-[#707070] dark:text-grey"
                  >
                    {format(day, 'EEE')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]?.toISOString()}>
                  {week.map((date) => {
                    const day = toDay(date)
                    const due = byDay.get(day) ?? []
                    const shown = mode === 'month' ? due.slice(0, MONTH_CELL_TASKS) : due
                    const outside = mode === 'month' && !isSameMonth(date, anchor)
                    return (
                      <td
                        key={day}
                        aria-label={`${format(date, 'EEEE d MMMM')}, ${String(due.length)} task${due.length === 1 ? '' : 's'}`}
                        onDragOver={(event) => {
                          if (!dragging) return
                          event.preventDefault()
                          setOver(day)
                        }}
                        onDragLeave={() => {
                          setOver((current) => (current === day ? null : current))
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          drop(day)
                        }}
                        className={cn(
                          'overflow-hidden rounded-xl border border-[#ECECEC] bg-white p-1.5 align-top dark:border-border dark:bg-card',
                          mode === 'month' ? 'h-28' : 'h-80',
                          outside && 'bg-[#FAFAFA] dark:bg-white/5',
                          over === day && 'border-[#7127EA] bg-[#F8F5FF] dark:bg-[#7127EA]/10',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium',
                            isToday(date)
                              ? 'bg-[#7127EA] text-white'
                              : outside
                                ? 'text-[#B0B0B0]'
                                : 'text-[#4A4A4A] dark:text-title',
                          )}
                        >
                          {format(date, 'd')}
                        </span>
                        {shown.length > 0 && (
                          <ul className="grid min-w-0 grid-cols-1 gap-1">{shown.map(chip)}</ul>
                        )}
                        {due.length > shown.length && (
                          <button
                            type="button"
                            onClick={() => {
                              onSearch({ calendar: 'week', on: day })
                            }}
                            className="mt-1 rounded px-1 text-[0.6875rem] font-semibold text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
                          >
                            +{due.length - shown.length} more
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ol aria-label={`Tasks by due date, ${title}`} className="grid gap-3">
            {days.filter((date) => byDay.has(toDay(date))).length === 0 && (
              <li className="rounded-xl bg-white px-4 py-8 text-center text-sm text-[#707070] dark:bg-card dark:text-grey">
                Nothing is due in these dates.
              </li>
            )}
            {days
              .filter((date) => byDay.has(toDay(date)))
              .map((date) => (
                <li key={toDay(date)} className="grid gap-1.5 rounded-xl bg-white p-3 dark:bg-card">
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isToday(date)
                        ? 'text-[#7127EA] dark:text-[#C4ABFF]'
                        : 'text-[#303030] dark:text-title',
                    )}
                  >
                    {format(date, 'EEE d MMM')}
                  </h3>
                  <ul className="grid gap-1">{(byDay.get(toDay(date)) ?? []).map(chip)}</ul>
                </li>
              ))}
          </ol>
        )}

        <section
          aria-labelledby="calendar-unscheduled"
          className="grid content-start gap-2 rounded-xl bg-white p-3 dark:bg-card"
        >
          <h3
            id="calendar-unscheduled"
            className="text-sm font-semibold text-[#303030] dark:text-title"
          >
            Unscheduled ({unscheduled.length})
          </h3>
          <p className="text-xs text-[#707070] dark:text-grey">
            {access.editTasks
              ? 'Open tasks without a due date. Drag one onto a day, or open it to pick a date.'
              : 'Open tasks without a due date.'}
          </p>
          {unscheduled.length > 0 ? (
            <ul className="grid gap-1">{unscheduled.map(chip)}</ul>
          ) : (
            <p className="text-xs text-[#909090]">Every open task has a due date.</p>
          )}
        </section>
      </div>
    </div>
  )
}
