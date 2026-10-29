import { useEffect, useRef, useState } from 'react'
import { isToday } from 'date-fns'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import { cn } from '@/lib/utils'

import { PRIORITY_META } from '../../constants'
import { useCreateTask } from '../../hooks/use-pm'
import type { TaskRow, TaskStatus, TaskType } from '../../types/pm.types'
import { formatCellDate, fromDay } from '../task-fields/field-utils'
import { useListView } from './list-context'
import { PmMenu, PmMenuContent, PmMenuItem, PmMenuLabel, PmMenuTrigger } from './menu-parts'
import { TaskRowMenu } from './task-row-menu'
import { MilestoneIcon, PlusIcon, StatusRingIcon, SubtaskIcon } from './workspace-icons'

/** The column a dragged card would join: the end of it (after its last card). */
const endOrder = (tasks: readonly TaskRow[]) =>
  tasks.reduce((highest, task) => Math.max(highest, task.order), 0) + 10

const chip =
  'inline-flex h-5 items-center rounded px-1.5 text-[0.6875rem] font-medium whitespace-nowrap'

/** Whether a dragged task may land among the top-level cards (subtasks stay under their task). */
function useDropRule() {
  const { allTasks, draggingId } = useListView()
  return () => {
    if (!draggingId) return null
    const moving = allTasks.find((task) => task.id === draggingId)
    if (!moving) return null
    const ids = new Set(allTasks.map((task) => task.id))
    return !moving.parentId || !ids.has(moving.parentId) ? moving : null
  }
}

/** The inline "Add Task" at a column's foot: a name, Enter to add, Escape to close. */
function AddCard({
  status,
  type,
  listId,
  open,
  onOpenChange,
}: {
  status: TaskStatus
  type: TaskType
  listId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { workspace } = useListView()
  const create = useCreateTask()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Add Task to ${status.name}`}
        onClick={() => {
          onOpenChange(true)
        }}
        className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
      >
        <PlusIcon className="size-3.5" />
        Add Task
      </button>
    )
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(`Enter the ${type === 'milestone' ? 'milestone' : 'task'} name`)
      return
    }
    setError(null)
    try {
      await create.mutateAsync({
        workspaceId: workspace.id,
        listId,
        parentId: null,
        name: trimmed,
        statusId: status.id,
        type,
      })
      setName('')
    } catch {
      // The global mutation toast explains; the box keeps the name.
    }
  }

  return (
    <form
      aria-label={`New ${type === 'milestone' ? 'milestone' : 'task'} in ${status.name}`}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="grid gap-1 rounded-xl border border-[#7127EA] bg-white p-2 dark:bg-card"
    >
      <input
        ref={input}
        value={name}
        maxLength={200}
        aria-label="Task name"
        aria-invalid={Boolean(error)}
        placeholder={type === 'milestone' ? 'Milestone name' : 'Task name'}
        onChange={(event) => {
          setName(event.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onOpenChange(false)
          }
        }}
        className="h-9 rounded-lg px-2 text-sm text-[#303030] outline-none placeholder:text-[#909090] dark:text-title"
      />
      {error && <p className="px-2 text-xs text-[#DC3545] dark:text-[#FF8A94]">{error}</p>}
      <p className="px-2 text-[0.6875rem] text-[#909090]">Enter adds it; Escape closes.</p>
    </form>
  )
}

/** One task as a card: name, code, priority, due date, people, subtasks and comments. */
function BoardCard({
  task,
  status,
  onOpenTask,
}: {
  task: TaskRow
  status: TaskStatus
  onOpenTask: (task: TaskRow) => void
}) {
  const view = useListView()
  const { workspace, access, actions, people, draggingId, onDragging, renamingId, onRename } = view
  const droppable = useDropRule()
  const [dropping, setDropping] = useState(false)
  const canDrag = access.editTasks
  const priority = task.priority ? PRIORITY_META[task.priority] : null
  const others = workspace.setup.statuses.filter((entry) => entry.id !== task.statusId)
  const columnOf = (statusId: string) =>
    view.allTasks.filter((entry) => entry.statusId === statusId && !entry.parentId)
  const titleId = `card-${task.id}`

  return (
    <article
      aria-labelledby={titleId}
      id={`task-${task.id}`}
      draggable={canDrag}
      onDragStart={(event) => {
        const transfer = event.dataTransfer as DataTransfer | null
        transfer?.setData('text/plain', task.id)
        onDragging(task.id)
      }}
      onDragEnd={() => {
        onDragging(null)
      }}
      onDragOver={(event) => {
        const moving = droppable()
        if (!moving || moving.id === task.id) return
        event.preventDefault()
        event.stopPropagation()
        setDropping(true)
      }}
      onDragLeave={() => {
        setDropping(false)
      }}
      onDrop={(event) => {
        const moving = droppable()
        setDropping(false)
        if (!moving || moving.id === task.id) return
        event.preventDefault()
        event.stopPropagation()
        // It takes this card's place (and this column's status), as rows do in the List view.
        view.onMove(moving.id, task.id)
        onDragging(null)
      }}
      className={cn(
        'grid gap-2 rounded-[0.875rem] border border-[#ECECEC] bg-white p-3 text-left dark:border-border dark:bg-card',
        canDrag && 'cursor-grab active:cursor-grabbing',
        draggingId === task.id && 'opacity-50',
        dropping && 'border-[#7127EA] ring-2 ring-[#A181FF]/40',
        view.highlightedId === task.id && 'ring-2 ring-[#A181FF]',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0" style={{ color: status.color }} aria-hidden="true">
          {task.type === 'milestone' ? (
            <MilestoneIcon className="size-4" />
          ) : (
            <StatusRingIcon className="size-4" />
          )}
        </span>
        {renamingId === task.id ? (
          <input
            // Focus moves here from the card menu's "Rename Task".
            autoFocus
            defaultValue={task.name}
            aria-label={`Rename ${task.name}`}
            maxLength={200}
            onFocus={(event) => {
              event.currentTarget.select()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                actions.rename(task, event.currentTarget.value)
                onRename(null)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onRename(null)
              }
            }}
            onBlur={(event) => {
              actions.rename(task, event.currentTarget.value)
              onRename(null)
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[#7127EA] px-2 text-sm font-medium text-[#303030] outline-none dark:text-title"
          />
        ) : (
          <button
            type="button"
            id={titleId}
            onClick={() => {
              onOpenTask(task)
            }}
            title="Open in the List view"
            className="min-w-0 flex-1 text-left text-sm leading-snug font-medium text-[#303030] outline-none hover:text-[#7127EA] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title dark:hover:text-[#C4ABFF]"
          >
            {task.name}
          </button>
        )}
        <TaskRowMenu task={task} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.6875rem] text-[#909090]">{task.code}</span>
        {priority && (
          <span
            className={chip}
            style={{ color: priority.color, backgroundColor: `${priority.color}14` }}
          >
            {priority.label}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              chip,
              task.isOverdue
                ? 'bg-[#FDECEE] text-[#B7192C] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3]'
                : 'bg-[#F4F4F4] text-[#626262] dark:bg-white/5 dark:text-title',
            )}
          >
            {isToday(fromDay(task.dueDate)) ? 'Today' : formatCellDate(task.dueDate)}
            {task.isOverdue && <span className="sr-only">, overdue</span>}
          </span>
        )}
        {task.isClosedLate && (
          <span
            className={cn(
              chip,
              'bg-[#FDECEE] text-[#B7192C] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3]',
            )}
          >
            Closed late
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((entry) => (
            <EmployeeAvatar
              key={entry.employeeId}
              name={entry.name}
              photoUrl={people.get(entry.employeeId)?.photoUrl ?? null}
              className="size-6 ring-2 ring-white"
            />
          ))}
          {task.assignees.length > 3 && (
            <span className="flex size-6 items-center justify-center rounded-full bg-[#F0E9FD] text-[0.625rem] font-semibold text-[#7127EA] ring-2 ring-white dark:bg-[#7127EA]/20 dark:text-[#C4ABFF]">
              +{task.assignees.length - 3}
            </span>
          )}
        </span>
        <span className="sr-only">
          {task.assignees.length > 0
            ? `Assigned to ${task.assignees.map((entry) => entry.name).join(', ')}`
            : 'Not assigned'}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[0.6875rem] text-[#707070] dark:text-grey">
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-1">
              <SubtaskIcon className="h-3 w-3" />
              {task.subtaskCount}
              <span className="sr-only"> subtasks</span>
            </span>
          )}
          {task.commentCount > 0 && (
            <span>
              {task.commentCount} comment{task.commentCount === 1 ? '' : 's'}
            </span>
          )}
        </span>
        {canDrag && others.length > 0 && (
          // The keyboard's way to move a card: the same as dropping it at the end of a column.
          <PmMenu modal={false}>
            <PmMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Move ${task.name} to another status`}
                className="rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
              >
                Move
              </button>
            </PmMenuTrigger>
            <PmMenuContent align="end" className="w-[14rem]">
              <PmMenuLabel>Move to</PmMenuLabel>
              {others.map((entry) => (
                <PmMenuItem
                  key={entry.id}
                  onSelect={() => {
                    actions.reorder(task, endOrder(columnOf(entry.id)), entry.id)
                  }}
                >
                  {entry.name}
                </PmMenuItem>
              ))}
            </PmMenuContent>
          </PmMenu>
        )}
      </div>
    </article>
  )
}

/**
 * The Board view (not drawn; approved layout): one column per workspace status, in order, with
 * the top-level tasks as cards. Dragging a card onto another puts it there (and gives it that
 * column's status); dropping it on a column's free space, or its "Move" menu, puts it last in
 * that column. "Add Task" at a column's foot adds a task with that status. Search and Filters
 * narrow the cards; columns scroll sideways on narrow screens.
 */
export function BoardView({
  groups,
  listId,
  composer,
  onCloseComposer,
  onOpenTask,
}: {
  groups: readonly { status: TaskStatus; tasks: TaskRow[] }[]
  listId: string | null
  /** The view bar's Add Task opens the first column's box. */
  composer: { statusId: string; type: TaskType } | null
  onCloseComposer: () => void
  onOpenTask: (task: TaskRow) => void
}) {
  const { access, actions, onDragging } = useListView()
  const droppable = useDropRule()
  const [adding, setAdding] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  return (
    <div className="relative flex snap-x gap-4 overflow-x-auto pb-3" role="list" aria-label="Board">
      {groups.map(({ status, tasks }) => {
        const cards = tasks.toSorted((a, b) => a.order - b.order)
        const open = adding === status.id || composer?.statusId === status.id
        const headingId = `column-${status.id}`
        return (
          <section
            key={status.id}
            role="listitem"
            aria-labelledby={headingId}
            onDragOver={(event) => {
              if (!droppable()) return
              event.preventDefault()
              setOver(status.id)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
            }}
            onDrop={(event) => {
              const moving = droppable()
              setOver(null)
              if (!moving) return
              event.preventDefault()
              actions.reorder(
                moving,
                endOrder(cards.filter((task) => task.id !== moving.id)),
                status.id,
              )
              onDragging(null)
            }}
            className={cn(
              'flex w-[18.5rem] shrink-0 snap-start flex-col gap-3 rounded-[1.125rem] bg-[#F8F8F8] p-3 dark:bg-white/5',
              over === status.id && 'bg-[#F0E9FD] dark:bg-[#7127EA]/20',
            )}
          >
            <h3
              id={headingId}
              className="flex items-center gap-2 px-1 text-base font-semibold text-[#626262] dark:text-title"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: status.color }}
                aria-hidden="true"
              />
              {status.name}
              <span
                className="rounded bg-white px-2 text-sm font-medium dark:bg-card"
                aria-label={`${cards.length} task${cards.length === 1 ? '' : 's'}`}
              >
                {cards.length}
              </span>
            </h3>
            {cards.map((task) => (
              <BoardCard key={task.id} task={task} status={status} onOpenTask={onOpenTask} />
            ))}
            {cards.length === 0 && !open && (
              <p className="rounded-xl border border-dashed border-[#DADADA] px-3 py-6 text-center text-xs text-[#909090] dark:border-border">
                No tasks{access.editTasks ? '. Drop one here.' : '.'}
              </p>
            )}
            {access.addTasks && (
              <AddCard
                status={status}
                type={composer?.statusId === status.id ? composer.type : 'task'}
                listId={listId}
                open={open}
                onOpenChange={(next) => {
                  setAdding(next ? status.id : null)
                  if (!next && composer?.statusId === status.id) onCloseComposer()
                }}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
