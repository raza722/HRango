import { type KeyboardEvent, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { columnEditable } from '../../hooks/use-pm-access'
import type { TaskRow, TaskStatus } from '../../types/pm.types'
import { TASK_CELLS, TaskNameAdornments } from '../task-fields/task-cells'
import { useListView } from './list-context'
import { COLUMN_GAP, COLUMN_WIDTHS, INDENT_REM, TAIL_WIDTH } from './list-utils'
import { TaskRowMenu } from './task-row-menu'
import {
  DragHandleIcon,
  ExpandIcon,
  MilestoneIcon,
  StatusRingIcon,
  SubtaskIcon,
} from './workspace-icons'
import { listStyles } from './workspace-styles'

/**
 * Columns whose cell is only a popup to edit the value: read-only, they become inert. Comments
 * (Latest Comment), the files list and time entries still open to read.
 */
const READ_ONLY_INERT: ReadonlySet<string> = new Set([
  'assignees',
  'startDate',
  'dueDate',
  'priority',
  'tags',
  'labels',
  'status',
  'timeEstimate',
  'storyPoints',
  'dependencies',
])

/**
 * One task row (task row group 1:2779) and, when expanded, its subtasks indented under it.
 * `siblings` are the rows of the same level in display order (for keyboard reordering).
 */
export function TaskRowView({
  task,
  depth,
  siblings,
  childrenOf,
  group,
}: {
  task: TaskRow
  depth: number
  siblings: readonly TaskRow[]
  childrenOf: (taskId: string) => TaskRow[]
  /** The status group the row is drawn in. */
  group: TaskStatus
}) {
  const view = useListView()
  const { workspace, allTasks, columns, selected, onSelect, expanded, onToggleExpand } = view
  const [dropping, setDropping] = useState(false)
  const children = childrenOf(task.id)
  const open = expanded.has(task.id) && children.length > 0
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId) ?? group
  const index = siblings.findIndex((row) => row.id === task.id)
  const isSelected = selected.has(task.id)

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!step) return
    event.preventDefault()
    const target = siblings[index + step]
    if (target) view.onMove(task.id, target.id)
  }

  /** Rows trade places with rows of their level: tasks with tasks, subtasks with their siblings. */
  const canDrop = () => {
    const dragged = view.draggingId
    if (!dragged || dragged === task.id) return false
    const moving = allTasks.find((row) => row.id === dragged)
    if (!moving) return false
    if (depth > 0) return moving.parentId === task.parentId
    return !moving.parentId || !allTasks.some((row) => row.id === moving.parentId)
  }

  const tone = cn(isSelected && 'bg-[#F8F5FF] dark:bg-[#7127EA]/10', dropping && 'border-[#7127EA]')

  return (
    <>
      <div
        role="row"
        id={`task-${task.id}`}
        aria-selected={isSelected}
        aria-level={depth + 1}
        onDragOver={(event) => {
          if (!canDrop()) return
          event.preventDefault()
          setDropping(true)
        }}
        onDragLeave={() => {
          setDropping(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDropping(false)
          const dragged = view.draggingId
          if (dragged && canDrop()) view.onMove(dragged, task.id)
          view.onDragging(null)
        }}
        className={cn(
          listStyles.row,
          view.highlightedId === task.id && 'rounded-[0.875rem] ring-2 ring-[#A181FF]',
          view.draggingId === task.id && 'opacity-50',
        )}
      >
        <div
          role="cell"
          className={cn(listStyles.stickyStart, 'gap-2 pl-1.5', tone)}
          style={{ width: COLUMN_WIDTHS.name }}
        >
          <button
            type="button"
            draggable={!view.sort}
            aria-label={`Reorder ${task.name}`}
            title={
              view.sort
                ? 'Clear the sort to reorder tasks'
                : 'Drag, or press the up and down arrow keys, to move the task'
            }
            aria-disabled={Boolean(view.sort)}
            onKeyDown={view.sort ? undefined : onHandleKey}
            onDragStart={(event) => {
              // Synthetic drags (tests, some assistive tools) come without a DataTransfer.
              const transfer = event.dataTransfer as DataTransfer | null
              transfer?.setData('text/plain', task.id)
              const row = event.currentTarget.closest('[role="row"]')
              if (row instanceof HTMLElement) transfer?.setDragImage(row, 24, 40)
              view.onDragging(task.id)
            }}
            onDragEnd={() => {
              view.onDragging(null)
            }}
            className={cn(
              'flex h-10 w-7 shrink-0 items-center justify-center rounded-[0.65rem] text-[#CECECE] outline-none hover:text-[#A4A4A4] focus-visible:ring-2 focus-visible:ring-[#A181FF]',
              view.sort ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
            )}
          >
            <DragHandleIcon className="h-[1.295rem] w-[0.81rem]" />
          </button>
          <Checkbox
            aria-label={`Select ${task.name}`}
            checked={isSelected}
            onCheckedChange={(checked) => {
              onSelect([task.id], checked === true)
            }}
            className={listStyles.checkbox}
          />
          {children.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? `Collapse ${task.name}` : `Expand ${task.name}`}
              onClick={() => {
                onToggleExpand(task.id)
              }}
              className={cn(listStyles.iconButton, 'size-[2.4rem] rounded-[0.65rem]')}
            >
              <ExpandIcon
                className={cn(
                  'h-[0.984rem] w-[0.575rem] transition-transform',
                  open && 'rotate-90',
                )}
              />
            </button>
          ) : (
            <span className="size-[2.4rem] shrink-0" aria-hidden="true" />
          )}
          <div
            className="flex h-[3.6875rem] min-w-0 flex-1 items-center rounded-xl border border-[#E9E9E9] bg-white pr-2 dark:border-border dark:bg-card"
            style={depth ? { marginLeft: `${depth * INDENT_REM}rem` } : undefined}
          >
            <span
              title={status.name}
              className="mx-[0.594rem] flex size-[2.4rem] shrink-0 items-center justify-center rounded-[0.52rem] bg-[#F8F8F8] dark:bg-white/5"
              style={{ color: status.color }}
            >
              {task.type === 'milestone' ? (
                <MilestoneIcon className="size-[1.4rem]" />
              ) : (
                <StatusRingIcon className="size-[1.55rem]" />
              )}
              <span className="sr-only">
                {status.name}
                {task.type === 'milestone' ? ', milestone' : ''}
              </span>
            </span>
            <TaskName task={task} />
            <span className="flex shrink-0 items-center gap-2 pl-2">
              {task.subtaskCount > 0 && (
                <span
                  title={`${task.subtaskCount} subtask${task.subtaskCount === 1 ? '' : 's'}`}
                  className="flex h-[1.7rem] items-center gap-2.5 rounded-[0.37rem] bg-[#E7F6FF] px-2 text-[1.1858rem] leading-none text-[#4287B0] dark:bg-sky-500/15 dark:text-sky-300"
                >
                  <SubtaskIcon className="h-[1.2rem] w-[1.15rem]" />
                  {task.subtaskCount}
                  <span className="sr-only"> subtasks</span>
                </span>
              )}
              <TaskNameAdornments task={task} workspace={workspace} tasks={allTasks} />
            </span>
          </div>
        </div>

        <div className={cn(listStyles.middle, tone)} style={{ paddingRight: COLUMN_GAP }}>
          {columns
            .filter((column) => column.key !== 'name')
            .map((column) => {
              const Cell = TASK_CELLS[column.key]
              // Can View / Private Field, or no edit rights: the value shows but its popup does not open.
              const readOnly = !view.access.editTasks || !columnEditable(workspace, column.key)
              return (
                <div
                  key={column.key}
                  role="cell"
                  inert={readOnly && READ_ONLY_INERT.has(column.key) ? true : undefined}
                  aria-readonly={readOnly || undefined}
                  className={listStyles.cell}
                  style={{ width: COLUMN_WIDTHS[column.key], marginLeft: COLUMN_GAP }}
                >
                  <Cell task={task} workspace={workspace} tasks={allTasks} />
                </div>
              )
            })}
        </div>

        <div role="cell" className={cn(listStyles.tail, tone)} style={{ width: TAIL_WIDTH }}>
          <TaskRowMenu task={task} />
        </div>
      </div>

      {open &&
        children.map((child) => (
          <TaskRowView
            key={child.id}
            task={child}
            depth={depth + 1}
            siblings={children}
            childrenOf={childrenOf}
            group={group}
          />
        ))}
    </>
  )
}

/** The name, or the rename box while renaming. */
function TaskName({ task }: { task: TaskRow }) {
  const { renamingId, onRename, actions, access } = useListView()

  if (renamingId !== task.id) {
    return (
      <span
        className="min-w-0 flex-1 truncate text-[1.1858rem] leading-[1.5] font-medium text-[#626262] dark:text-title"
        title={task.name}
        onDoubleClick={() => {
          if (access.editTasks) onRename(task.id)
        }}
      >
        {task.name}
      </span>
    )
  }

  const finish = (value: string | null) => {
    if (value !== null) actions.rename(task, value)
    onRename(null)
  }

  return (
    <input
      // Focus moves here from the row menu's "Rename Task".
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
          finish(event.currentTarget.value)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(null)
        }
      }}
      onBlur={(event) => {
        finish(event.currentTarget.value)
      }}
      className="h-9 min-w-0 flex-1 rounded-lg border border-[#7127EA] bg-white px-2 text-[1.1858rem] font-medium text-[#626262] ring-4 ring-[#7127EA]/20 outline-none dark:bg-card dark:text-title"
    />
  )
}
