import { useRef } from 'react'

import { cn } from '@/lib/utils'

import type { TaskRow, TaskStatus, TaskType } from '../../types/pm.types'
import { ColumnHeaderRow } from './column-header-row'
import { useListView } from './list-context'
import { averageStoryPoints, COLUMN_GAP, COLUMN_WIDTHS, sortTasks, TAIL_WIDTH } from './list-utils'
import { PmMenu, PmMenuContent, PmMenuItem, PmMenuTrigger } from './menu-parts'
import { NewTaskRow } from './new-task-row'
import { TaskRowView } from './task-row'
import {
  ChevronDownIcon,
  ExpandIcon,
  MilestoneIcon,
  RowDotsIcon,
  StatusRingIcon,
  TaskIcon,
} from './workspace-icons'
import { listStyles } from './workspace-styles'

/**
 * One status of the List view: its header ("To Do Status" in 1:2755: collapse arrow, status chip
 * with the count, three dots, "Add Task"), the column headers, the task rows with their
 * subtasks, the inline new-task row, and the "Average Story Points" footer when that column shows.
 */
export function StatusGroup({
  status,
  tasks,
  childrenOf,
  collapsed,
  onCollapsedChange,
  composing,
  listId,
  onCloseComposer,
  onSelectAll,
  onCollapseAll,
}: {
  status: TaskStatus
  /** Top-level tasks of the group (after search and filters). */
  tasks: readonly TaskRow[]
  childrenOf: (taskId: string) => TaskRow[]
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** The new-task row is open in this group, for a task or a milestone. */
  composing: TaskType | null
  listId: string | null
  onCloseComposer: () => void
  onSelectAll: (ids: readonly string[]) => void
  onCollapseAll: (collapsed: boolean) => void
}) {
  const view = useListView()
  const rows = sortTasks(tasks, view.sort, view.sortContext)
  const sortedChildren = (taskId: string) =>
    sortTasks(childrenOf(taskId), view.sort, view.sortContext)

  // Every task drawn under the group, subtasks included, for select-all and the footer.
  const drawn: TaskRow[] = []
  const collect = (row: TaskRow) => {
    drawn.push(row)
    for (const child of childrenOf(row.id)) collect(child)
  }
  for (const row of rows) collect(row)
  const ids = drawn.map((row) => row.id)

  const showsStoryPoints = view.columns.some((column) => column.key === 'storyPoints')
  const average = averageStoryPoints(drawn)
  const headingId = `group-${status.id}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="sticky left-0 flex h-[4.3125rem] w-fit max-w-full min-w-0 items-center gap-5 rounded-[0.625rem] bg-white pr-3 pl-2.5 sm:min-w-[30rem] dark:bg-card">
        <span className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`${headingId}-rows`}
            aria-label={collapsed ? `Expand ${status.name}` : `Collapse ${status.name}`}
            onClick={() => {
              onCollapsedChange(!collapsed)
            }}
            className={cn(listStyles.iconButton, 'size-[2.4rem] rounded-[0.65rem]')}
          >
            <ExpandIcon
              className={cn(
                'h-[0.984rem] w-[0.575rem] transition-transform',
                !collapsed && 'rotate-90',
              )}
            />
          </button>
          <span className="flex h-[3.0625rem] min-w-0 items-center gap-[1.6875rem] rounded-lg bg-[#F8F8F8] px-2.5 dark:bg-white/5">
            <span className="flex min-w-0 items-center">
              <span
                className="flex size-[2.4rem] shrink-0 items-center justify-center rounded-[0.61rem] bg-white dark:bg-card"
                style={{ color: status.color }}
              >
                <StatusRingIcon className="size-[1.8rem]" />
              </span>
              <h3
                id={headingId}
                className="truncate px-2.5 text-lg leading-[1.5] font-semibold text-[#626262] dark:text-title"
              >
                {status.name}
              </h3>
            </span>
            <span
              aria-label={`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
              className="flex h-[1.6875rem] shrink-0 items-center rounded bg-white px-[0.9375rem] text-lg font-medium text-[#626262] dark:bg-card dark:text-title"
            >
              {tasks.length}
            </span>
          </span>
        </span>
        <PmMenu modal={false}>
          <PmMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${status.name} group actions`}
              className={cn(listStyles.iconButton, 'h-[1.875rem] w-[2.1875rem]')}
            >
              <RowDotsIcon className="h-[0.33rem] w-[1.3125rem]" />
            </button>
          </PmMenuTrigger>
          <PmMenuContent align="start">
            <PmMenuItem
              disabled={ids.length === 0}
              onSelect={() => {
                onSelectAll(ids)
              }}
            >
              Select All Tasks
            </PmMenuItem>
            <PmMenuItem
              onSelect={() => {
                onCollapseAll(true)
              }}
            >
              Collapse All Groups
            </PmMenuItem>
            <PmMenuItem
              onSelect={() => {
                onCollapseAll(false)
              }}
            >
              Expand All Groups
            </PmMenuItem>
          </PmMenuContent>
        </PmMenu>
        {view.access.addTasks && (
          <AddTaskMenu
            label={`Add Task to ${status.name}`}
            onPick={(type) => {
              view.onCompose(status.id, type)
            }}
          />
        )}
      </div>

      {!collapsed && (
        <div
          id={`${headingId}-rows`}
          role="table"
          aria-labelledby={headingId}
          className="flex flex-col gap-3.5"
        >
          <ColumnHeaderRow groupLabel={status.name} taskIds={ids} />
          {(rows.length > 0 || composing) && (
            <div role="rowgroup" className="flex flex-col gap-3.5">
              {rows.map((task) => (
                <TaskRowView
                  key={task.id}
                  task={task}
                  depth={0}
                  siblings={rows}
                  childrenOf={sortedChildren}
                  group={status}
                />
              ))}
              {composing && (
                <NewTaskRow
                  status={status}
                  type={composing}
                  listId={listId}
                  onClose={onCloseComposer}
                />
              )}
            </div>
          )}
          {showsStoryPoints && (
            <div role="row" className="flex w-max min-w-full items-center">
              <div
                role="cell"
                className="shrink-0 @5xl/list:sticky @5xl/list:left-0"
                style={{ width: COLUMN_WIDTHS.name }}
              />
              <div
                className="flex min-w-0 flex-1 items-center"
                style={{ paddingRight: COLUMN_GAP }}
              >
                {view.columns
                  .filter((column) => column.key !== 'name')
                  .map((column) => (
                    <div
                      key={column.key}
                      role="cell"
                      className="shrink-0"
                      style={{ width: COLUMN_WIDTHS[column.key], marginLeft: COLUMN_GAP }}
                    >
                      {column.key === 'storyPoints' && (
                        <span className="flex h-[2.4375rem] items-center justify-between gap-3 rounded-md bg-white px-1.5 text-lg font-semibold text-[#626262] dark:bg-card dark:text-title">
                          Average Story Points
                          <span className="font-medium">
                            {average === null ? '—' : Number(average.toFixed(1))}
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
              </div>
              <div role="cell" className="shrink-0" style={{ width: TAIL_WIDTH }} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** The group's "Add Task" with its drop-down: a task or a milestone. */
export function AddTaskMenu({
  label,
  onPick,
}: {
  label: string
  onPick: (type: TaskType) => void
}) {
  // A pick moves focus to the new-task row, not back to this button.
  const picked = useRef(false)
  const pick = (type: TaskType) => {
    picked.current = true
    onPick(type)
  }
  return (
    <PmMenu modal={false}>
      <PmMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-[3.19rem] shrink-0 items-center gap-[0.6rem] rounded-[0.72rem] px-[0.96rem] text-[1.078rem] leading-[1.5] font-semibold text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
        >
          Add Task
          <ChevronDownIcon className="h-2 w-3.5" />
        </button>
      </PmMenuTrigger>
      <PmMenuContent
        align="start"
        className="w-[13rem]"
        onCloseAutoFocus={(event) => {
          if (picked.current) event.preventDefault()
          picked.current = false
        }}
      >
        <PmMenuItem
          icon={<TaskIcon />}
          onSelect={() => {
            pick('task')
          }}
        >
          Task
        </PmMenuItem>
        <PmMenuItem
          icon={<MilestoneIcon />}
          onSelect={() => {
            pick('milestone')
          }}
        >
          Milestone
        </PmMenuItem>
      </PmMenuContent>
    </PmMenu>
  )
}
