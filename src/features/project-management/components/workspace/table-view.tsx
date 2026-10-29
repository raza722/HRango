import { format } from 'date-fns'
import { Download } from 'lucide-react'

import { downloadText, toCsv } from '@/features/payroll'

import { PRIORITY_META } from '../../constants'
import type { TaskRow, TaskStatus } from '../../types/pm.types'
import { ColumnHeaderRow } from './column-header-row'
import { useListView } from './list-context'
import { sortTasks, storyPointsOf, topLevel } from './list-utils'
import { TaskRowView } from './task-row'

/** A row whose status the workspace no longer has (none in practice: it has at least one). */
const UNKNOWN_STATUS: TaskStatus = { id: '', name: '', color: '#909090', group: 'not-started' }

const CSV_HEADER = [
  'Task ID',
  'Task Name',
  'Parent Task',
  'List',
  'Status',
  'Priority',
  'Assignees',
  'Start Date',
  'Due Date',
  'Tags',
  'Story Points',
  'Time Estimate (minutes)',
  'Time Tracked (minutes)',
  'Created By',
  'Date Created',
  'Date Closed',
] as const

/**
 * The Table view (not drawn; approved layout): the tasks as one table, not grouped by status,
 * with every column (the List view's cells, popups and row menus), the header kept in view while
 * the rows scroll, sorting from the headers, ticking for bulk delete, and Export CSV of the tasks
 * shown (subtasks included). Columns are arranged in the List view only.
 */
export function TableBody({
  visibleTasks,
  childrenOf,
  narrowed,
  tagNames,
}: {
  visibleTasks: readonly TaskRow[]
  childrenOf: (taskId: string) => TaskRow[]
  narrowed: boolean
  tagNames: (ids: readonly string[]) => string[]
}) {
  const { workspace, allTasks, sort, sortContext } = useListView()
  const statuses = workspace.setup.statuses
  const rows = sortTasks(topLevel(visibleTasks), sort, sortContext)
  const sortedChildren = (taskId: string) => sortTasks(childrenOf(taskId), sort, sortContext)

  // Every task the table holds (subtasks too), in order: for select-all and the export.
  const drawn: TaskRow[] = []
  const collect = (row: TaskRow) => {
    drawn.push(row)
    for (const child of sortedChildren(row.id)) collect(child)
  }
  for (const row of rows) collect(row)

  const exportCsv = () => {
    const nameOf = (id: string | null) => allTasks.find((task) => task.id === id)?.name ?? ''
    const csv = toCsv(
      CSV_HEADER,
      drawn.map((task) => [
        task.code,
        task.name,
        nameOf(task.parentId),
        task.listName ?? '',
        statuses.find((status) => status.id === task.statusId)?.name ?? '',
        task.priority ? PRIORITY_META[task.priority].label : '',
        task.assignees.map((entry) => entry.name).join('; '),
        task.startDate ?? '',
        task.dueDate ?? '',
        tagNames(task.tagIds).join('; '),
        task.storyPoints.length ? storyPointsOf(task) : '',
        task.timeEstimateMinutes ?? '',
        task.timeTrackedMinutes,
        task.createdByName ?? '',
        task.createdAt ? format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm') : '',
        task.closedAt ? format(new Date(task.closedAt), 'yyyy-MM-dd HH:mm') : '',
      ]),
    )
    const slug = workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    downloadText(csv, `${slug || 'workspace'}-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#707070] dark:text-grey">
          {drawn.length} task{drawn.length === 1 ? '' : 's'}
          {narrowed ? ' match' : ''}
        </p>
        <button
          type="button"
          disabled={drawn.length === 0}
          onClick={exportCsv}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#7127EA] bg-white px-4 text-sm font-semibold text-[#7127EA] outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] disabled:opacity-50 dark:bg-card dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/25"
        >
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </button>
      </div>
      {/* Rows scroll under the header; both scroll sideways together. */}
      <div className="@container/list relative overflow-x-auto pb-2 sm:max-h-[max(28rem,calc(100dvh-12rem))] sm:overflow-y-auto">
        {/* Phones: the page scrolls (no box inside it); wider screens keep the header in view. */}
        <div role="table" aria-label="Tasks" className="flex w-max min-w-full flex-col gap-3.5">
          <div className="sticky top-0 z-[6] bg-background pb-0.5">
            <ColumnHeaderRow groupLabel="listed" taskIds={drawn.map((task) => task.id)} />
          </div>
          {rows.length === 0 ? (
            <p
              role="status"
              className="sticky left-0 px-2 py-8 text-center text-sm text-[#707070] dark:text-grey"
            >
              No tasks match your search or filters.
            </p>
          ) : (
            <div role="rowgroup" className="flex flex-col gap-3.5">
              {rows.map((task) => (
                <TaskRowView
                  key={task.id}
                  task={task}
                  depth={0}
                  siblings={rows}
                  childrenOf={sortedChildren}
                  group={
                    statuses.find((status) => status.id === task.statusId) ??
                    statuses[0] ?? { ...UNKNOWN_STATUS, id: task.statusId }
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
