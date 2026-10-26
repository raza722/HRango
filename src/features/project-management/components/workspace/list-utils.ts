import {
  addDays,
  addHours,
  addWeeks,
  format,
  isSaturday,
  nextMonday,
  nextSaturday,
  startOfDay,
} from 'date-fns'

import type {
  ListColumn,
  PmPerson,
  PmRole,
  Priority,
  Tag,
  TaskColumnKey,
  TaskRow,
  TaskStatus,
  Workspace,
} from '../../types/pm.types'

// --- columns ------------------------------------------------------------------------------------

/**
 * Width of each List view column: the "<name> Column" layers of Workspace Page 1:2755 (px ÷ 16).
 * Task Name holds the drag handle, checkbox and arrow before the name box. Labels has no layer of
 * its own and takes Add Tags' width.
 */
export const COLUMN_WIDTHS: Record<TaskColumnKey, string> = {
  name: '38.125rem',
  assignees: '16rem',
  startDate: '16.5rem',
  dueDate: '16.5rem',
  priority: '16.5rem',
  tags: '24.1875rem',
  dependencies: '25.75rem',
  status: '15rem',
  progress: '16.5rem',
  timeEstimate: '16.5rem',
  timeTracked: '16.5rem',
  taskId: '16.5rem',
  createdBy: '33.1875rem',
  dateCreated: '16.5rem',
  dateClosed: '16.5rem',
  latestComment: '16.5rem',
  storyPoints: '24.5rem',
  files: '20.625rem',
  labels: '24.1875rem',
}

/** Space between the columns ("Other Columns" gap 20 px). */
export const COLUMN_GAP = '1.25rem'
/** The row's end: three dots, or the header's round "+" (57 px). */
export const TAIL_WIDTH = '3.5625rem'
/** How far a subtask's name box moves in per level (not drawn). */
export const INDENT_REM = 1.75

/** Visible columns in order; Task Name always leads. */
export function visibleColumns(columns: readonly ListColumn[]): ListColumn[] {
  const shown = columns.filter((column) => column.visible && column.key !== 'name')
  const name = columns.find((column) => column.key === 'name')
  return name ? [{ ...name, visible: true }, ...shown] : shown
}

/** Columns the round "+" can add: hidden ones, and deleted ones (no longer in the list). */
export function addableColumns(
  columns: readonly ListColumn[],
  allKeys: readonly TaskColumnKey[],
): TaskColumnKey[] {
  return allKeys.filter(
    (key) => key !== 'name' && !columns.some((column) => column.key === key && column.visible),
  )
}

export const defaultColumn = (key: TaskColumnKey): ListColumn => ({
  key,
  visible: true,
  permission: { defaultLevel: 'default', roles: {}, members: [] },
})

/** Shows a column; a deleted one comes back at the end with default permissions. */
export function showColumn(columns: readonly ListColumn[], key: TaskColumnKey): ListColumn[] {
  if (columns.some((column) => column.key === key)) {
    return columns.map((column) => (column.key === key ? { ...column, visible: true } : column))
  }
  return [...columns, defaultColumn(key)]
}

export const hideColumn = (columns: readonly ListColumn[], key: TaskColumnKey): ListColumn[] =>
  columns.map((column) => (column.key === key ? { ...column, visible: false } : column))

export const deleteColumn = (columns: readonly ListColumn[], key: TaskColumnKey): ListColumn[] =>
  columns.filter((column) => column.key !== key)

/**
 * Moves a column to the start (just after Task Name) or the end of the visible columns.
 * Hidden columns keep their place relative to each other.
 */
export function moveColumn(
  columns: readonly ListColumn[],
  key: TaskColumnKey,
  to: 'start' | 'end',
): ListColumn[] {
  const moving = columns.find((column) => column.key === key)
  if (!moving || key === 'name') return [...columns]
  const rest = columns.filter((column) => column.key !== key)
  if (to === 'end') return [...rest, moving]
  const nameIndex = rest.findIndex((column) => column.key === 'name')
  return [...rest.slice(0, nameIndex + 1), moving, ...rest.slice(nameIndex + 1)]
}

/** Moves a column one place up or down among the visible ones (Customize). */
export function stepColumn(
  columns: readonly ListColumn[],
  key: TaskColumnKey,
  step: -1 | 1,
): ListColumn[] {
  const order = visibleColumns(columns).map((column) => column.key)
  const index = order.indexOf(key)
  const target = order[index + step]
  if (index < 1 || !target || target === 'name') return [...columns]
  const next = [...columns]
  const from = next.findIndex((column) => column.key === key)
  const to = next.findIndex((column) => column.key === target)
  const a = next[from]
  const b = next[to]
  if (!a || !b) return next
  next[from] = b
  next[to] = a
  return next
}

// --- sorting ------------------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc'
export interface ListSort {
  key: TaskColumnKey
  direction: SortDirection
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

export interface SortContext {
  people: ReadonlyMap<string, PmPerson>
  statuses: readonly TaskStatus[]
  tags: ReadonlyMap<string, Tag>
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

export const storyPointsOf = (task: TaskRow) => sum(task.storyPoints.map((entry) => entry.points))

export const trackedMinutesOf = (task: TaskRow) => task.timeTrackedMinutes

/** The value a column sorts by; null sorts last in both directions. */
export function sortValue(
  task: TaskRow,
  key: TaskColumnKey,
  context: SortContext,
): string | number | null {
  const firstTag = (ids: readonly string[]) =>
    ids.length ? (context.tags.get(ids[0] ?? '')?.name ?? '') : null
  switch (key) {
    case 'name':
      return task.name.toLowerCase()
    case 'assignees':
      return task.assignees[0]?.name.toLowerCase() ?? null
    case 'startDate':
      return task.startDate ? `${task.startDate} ${task.startTime ?? ''}` : null
    case 'dueDate':
      return task.dueDate ? `${task.dueDate} ${task.dueTime ?? ''}` : null
    case 'priority':
      return task.priority ? PRIORITY_RANK[task.priority] : null
    case 'tags':
      return firstTag(task.tagIds)?.toLowerCase() ?? null
    case 'labels':
      return firstTag(task.labelIds)?.toLowerCase() ?? null
    case 'dependencies':
      return task.openDependencyCount + task.blockingCount || null
    case 'status': {
      const index = context.statuses.findIndex((status) => status.id === task.statusId)
      return index < 0 ? null : index
    }
    case 'progress': {
      if (!task.timeEstimateMinutes) return null
      return trackedMinutesOf(task) / task.timeEstimateMinutes
    }
    case 'timeEstimate':
      return task.timeEstimateMinutes
    case 'timeTracked':
      return trackedMinutesOf(task) || null
    case 'taskId':
      return task.code
    case 'createdBy':
      return task.createdByName?.toLowerCase() ?? null
    case 'dateCreated':
      return task.createdAt
    case 'dateClosed':
      return task.closedAt
    case 'latestComment':
      return task.latestComment?.createdAt ?? null
    case 'storyPoints':
      return task.storyPoints.length ? storyPointsOf(task) : null
    case 'files':
      return task.attachmentCount || null
  }
}

/** Sorted copy: by the column (empty values last), then by the saved order. */
export function sortTasks(
  tasks: readonly TaskRow[],
  sort: ListSort | null,
  context: SortContext,
): TaskRow[] {
  const byOrder = (a: TaskRow, b: TaskRow) => a.order - b.order
  if (!sort) return tasks.toSorted(byOrder)
  const factor = sort.direction === 'asc' ? 1 : -1
  return tasks.toSorted((a, b) => {
    const left = sortValue(a, sort.key, context)
    const right = sortValue(b, sort.key, context)
    if (left === null && right === null) return byOrder(a, b)
    if (left === null) return 1
    if (right === null) return -1
    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    return compared === 0 ? byOrder(a, b) : compared * factor
  })
}

// --- tree, grouping, search ---------------------------------------------------------------------

/** Subtasks by parent id (only parents present in the view). */
export function childrenByParent(tasks: readonly TaskRow[]): Map<string, TaskRow[]> {
  const ids = new Set(tasks.map((task) => task.id))
  const map = new Map<string, TaskRow[]>()
  for (const task of tasks) {
    if (!task.parentId || !ids.has(task.parentId)) continue
    const siblings = map.get(task.parentId) ?? []
    siblings.push(task)
    map.set(task.parentId, siblings)
  }
  return map
}

/** Tasks drawn at the top of a group: no parent, or a parent outside the view. */
export function topLevel(tasks: readonly TaskRow[]): TaskRow[] {
  const ids = new Set(tasks.map((task) => task.id))
  return tasks.filter((task) => !task.parentId || !ids.has(task.parentId))
}

/** Top-level tasks per status, in the workspace's status order. */
export function groupByStatus(
  tasks: readonly TaskRow[],
  statuses: readonly TaskStatus[],
): { status: TaskStatus; tasks: TaskRow[] }[] {
  const top = topLevel(tasks)
  const groups = statuses.map((status) => ({
    status,
    tasks: top.filter((task) => task.statusId === status.id),
  }))
  // A status removed from the workspace still shows its tasks, under the first status.
  const known = new Set(statuses.map((status) => status.id))
  const orphans = top.filter((task) => !known.has(task.statusId))
  if (orphans.length && groups[0]) groups[0].tasks.push(...orphans)
  return groups
}

export interface TaskFilters {
  statusIds: string[]
  priorities: (Priority | 'none')[]
  assigneeIds: string[]
}

export const EMPTY_FILTERS: TaskFilters = { statusIds: [], priorities: [], assigneeIds: [] }

export const filterCount = (filters: TaskFilters) =>
  filters.statusIds.length + filters.priorities.length + filters.assigneeIds.length

function matchesFilters(task: TaskRow, filters: TaskFilters): boolean {
  if (filters.statusIds.length && !filters.statusIds.includes(task.statusId)) return false
  if (filters.priorities.length && !filters.priorities.includes(task.priority ?? 'none')) {
    return false
  }
  if (
    filters.assigneeIds.length &&
    !task.assigneeIds.some((id) => filters.assigneeIds.includes(id))
  ) {
    return false
  }
  return true
}

/**
 * The tasks the banner search and Filters keep: matching tasks and the parents above them, so a
 * matching subtask still shows under its task. `expand` lists the parents to open.
 */
export function narrowTasks(
  tasks: readonly TaskRow[],
  query: string,
  filters: TaskFilters,
): { tasks: TaskRow[]; expand: Set<string> } {
  const text = query.trim().toLowerCase()
  if (!text && filterCount(filters) === 0) return { tasks: [...tasks], expand: new Set() }
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const keep = new Set<string>()
  const expand = new Set<string>()
  for (const task of tasks) {
    const hit =
      (!text || task.name.toLowerCase().includes(text) || task.code.toLowerCase().includes(text)) &&
      matchesFilters(task, filters)
    if (!hit) continue
    keep.add(task.id)
    let parentId = task.parentId
    while (parentId && byId.has(parentId) && !keep.has(parentId)) {
      keep.add(parentId)
      expand.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
    if (parentId) expand.add(parentId)
  }
  return { tasks: tasks.filter((task) => keep.has(task.id)), expand }
}

/** A task and every subtask below it. */
export function descendantIds(taskId: string, tasks: readonly TaskRow[]): Set<string> {
  const ids = new Set([taskId])
  let grew = true
  while (grew) {
    grew = false
    for (const task of tasks) {
      if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
        ids.add(task.id)
        grew = true
      }
    }
  }
  return ids
}

/**
 * The `order` that puts `movingId` where `targetId` is among `siblings` (already in display
 * order): after the target when moving down, before it when moving up.
 */
export function orderForMove(
  siblings: readonly TaskRow[],
  movingId: string,
  targetId: string,
): number | null {
  const from = siblings.findIndex((task) => task.id === movingId)
  const to = siblings.findIndex((task) => task.id === targetId)
  const target = siblings[to]
  if (to < 0 || !target || movingId === targetId) return null
  const rest = siblings.filter((task) => task.id !== movingId)
  const targetIndex = rest.findIndex((task) => task.id === targetId)
  const after = from >= 0 && from < to
  const before = after ? rest[targetIndex] : rest[targetIndex - 1]
  const next = after ? rest[targetIndex + 1] : rest[targetIndex]
  if (!before && next) return next.order - 1
  if (before && !next) return before.order + 1
  if (before && next) return (before.order + next.order) / 2
  return target.order
}

/** Average of the story points of the tasks that have any; null when none do. */
export function averageStoryPoints(tasks: readonly TaskRow[]): number | null {
  const scored = tasks.filter((task) => task.storyPoints.length > 0)
  if (!scored.length) return null
  return sum(scored.map(storyPointsOf)) / scored.length
}

// --- people and roles ---------------------------------------------------------------------------

/** The workspace role a member holds (`members[].memberRole`; the owner is always an admin). */
export function roleOf(
  person: Pick<PmPerson, 'id'>,
  workspace: Pick<Workspace, 'members' | 'ownerId'>,
): PmRole {
  if (person.id === workspace.ownerId) return 'workspace-admin'
  return workspace.members.find((member) => member.employeeId === person.id)?.role ?? 'contributors'
}

// --- reminders ----------------------------------------------------------------------------------

export interface QuickPick {
  label: string
  /** What the pick resolves to, shown on the right ("Sat", "5:22 PM", "10 May"). */
  hint: string
  at: Date
}

const REMINDER_HOUR = 9

const atReminderHour = (date: Date) => {
  const next = startOfDay(date)
  next.setHours(REMINDER_HOUR, 0, 0, 0)
  return next
}

/** "Reminder Calendar" quick picks, worked out from `now`. */
export function reminderQuickPicks(now: Date): QuickPick[] {
  const tomorrow = atReminderHour(addDays(now, 1))
  const weekend = atReminderHour(isSaturday(now) ? addDays(now, 7) : nextSaturday(now))
  const nextWeek = atReminderHour(nextMonday(now))
  const nextWeekend = atReminderHour(addDays(weekend, 7))
  const twoWeeks = atReminderHour(addWeeks(now, 2))
  const fourWeeks = atReminderHour(addWeeks(now, 4))
  const later = addHours(now, 3)
  later.setSeconds(0, 0)
  return [
    { label: 'Tomorrow', hint: format(tomorrow, 'EEE'), at: tomorrow },
    { label: 'This Weekend', hint: format(weekend, 'EEE'), at: weekend },
    { label: 'Next Week', hint: format(nextWeek, 'EEE'), at: nextWeek },
    { label: 'Next Weekend', hint: format(nextWeekend, 'd MMM'), at: nextWeekend },
    { label: '2 Weeks', hint: format(twoWeeks, 'd MMM'), at: twoWeeks },
    { label: '4 Weeks', hint: format(fourWeeks, 'd MMM'), at: fourWeeks },
    { label: 'Later', hint: format(later, 'h:mm a'), at: later },
  ]
}
