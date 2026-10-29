import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns'

import { STATUS_GROUP_LABELS } from '../../constants'
import type { DashboardTask } from '../../hooks/use-dashboards'
import {
  STATUS_GROUPS,
  type StatusGroup,
  type Workspace,
  type WorkspaceSummary,
} from '../../types/pm.types'
import { fromDay, toDay } from '../task-fields/field-utils'
import { GROUP_COLOR_VARS } from './dashboard-styles'

// Pure figures for the dashboards, from the tasks the List view reads. Weeks start on Sunday, as
// in the module's Calendar view and date quick picks.

export const dayOf = (iso: string): string => toDay(parseISO(iso))

export function weekBounds(now: Date): { start: string; end: string } {
  return { start: toDay(startOfWeek(now)), end: toDay(endOfWeek(now)) }
}

const inRange = (day: string | null, start: string, end: string) =>
  day !== null && day >= start && day <= end

/** Open, due this week (today included) or already overdue. */
export function isDueSoonOrOverdue(task: DashboardTask, now: Date): boolean {
  if (task.done) return false
  if (task.isOverdue) return true
  const { end } = weekBounds(now)
  return inRange(task.dueDate, toDay(now), end)
}

export const completedThisWeek = (task: DashboardTask, now: Date): boolean => {
  const { start, end } = weekBounds(now)
  return task.done && task.closedAt !== null && inRange(dayOf(task.closedAt), start, end)
}

export const isInProgress = (task: DashboardTask) => task.group === 'active'

export const isUnassigned = (task: DashboardTask) => !task.done && task.assigneeIds.length === 0

// --- My Work buckets ---------------------------------------------------------------------------------

export const WORK_BUCKETS = ['overdue', 'today', 'next', 'later', 'unscheduled'] as const
export type WorkBucket = (typeof WORK_BUCKETS)[number]

export const WORK_BUCKET_LABELS: Record<WorkBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  next: 'Next 7 days',
  later: 'Later',
  unscheduled: 'No due date',
}

/** Where an open task falls in My Work, by its due date. */
export function workBucket(task: DashboardTask, now: Date): WorkBucket {
  if (!task.dueDate) return 'unscheduled'
  const today = toDay(now)
  if (task.isOverdue || task.dueDate < today) return 'overdue'
  if (task.dueDate === today) return 'today'
  if (task.dueDate <= toDay(addDays(now, 7))) return 'next'
  return 'later'
}

/** "Today", "Tomorrow", "In 3 days", "2 days overdue", or the date. */
export function dueLabel(task: Pick<DashboardTask, 'dueDate' | 'done'>, now: Date): string {
  if (!task.dueDate) return 'No due date'
  const days = differenceInCalendarDays(fromDay(task.dueDate), startOfDay(now))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0 && !task.done) return `${String(-days)} ${days === -1 ? 'day' : 'days'} overdue`
  if (days > 1 && days <= 6) return `In ${String(days)} days`
  return format(fromDay(task.dueDate), 'EEE, d MMM')
}

/** "Just now", "2h ago", "Yesterday", "3 Nov". */
export function whenLabel(iso: string, now: Date): string {
  const at = parseISO(iso)
  const minutes = Math.round((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  if (isToday(at)) return `${String(Math.floor(minutes / 60))}h ago`
  if (isYesterday(at)) return 'Yesterday'
  if (differenceInCalendarDays(now, at) < 7) return format(at, 'EEEE')
  return format(at, 'd MMM')
}

// --- status breakdown --------------------------------------------------------------------------------

export interface StatusSlice {
  key: string
  label: string
  /** CSS colour (a status's own hex, or a group's variable). */
  color: string
  count: number
}

/** A workspace's tasks by its own statuses, in the workspace's order (the List view's groups). */
export function slicesByStatus(
  workspace: Workspace,
  tasks: readonly DashboardTask[],
): StatusSlice[] {
  const known = workspace.setup.statuses.map((status) => ({
    key: status.id,
    label: status.name,
    color: status.color,
    count: tasks.filter((task) => task.statusId === status.id).length,
  }))
  const unknown = tasks.filter((task) => task.status === null).length
  return unknown > 0
    ? [...known, { key: 'unknown', label: 'Other', color: 'var(--dash-muted)', count: unknown }]
    : known
}

/** Tasks of several workspaces by status group (their statuses differ; the groups do not). */
export function slicesByGroup(tasks: readonly DashboardTask[]): StatusSlice[] {
  return STATUS_GROUPS.map((group: StatusGroup) => ({
    key: group,
    label: STATUS_GROUP_LABELS[group],
    color: GROUP_COLOR_VARS[group],
    count: tasks.filter((task) => task.group === group).length,
  }))
}

// --- per assignee ------------------------------------------------------------------------------------

export interface AssigneeLoad {
  /** Null for the unassigned tasks' row. */
  employeeId: string | null
  name: string
  open: number
  done: number
  total: number
}

/** Tasks per assignee (a task with two assignees counts for each), most open work first. */
export function loadByAssignee(tasks: readonly DashboardTask[]): AssigneeLoad[] {
  const byPerson = new Map<string, AssigneeLoad>()
  let unassigned: AssigneeLoad | null = null
  for (const task of tasks) {
    if (task.assignees.length === 0) {
      unassigned ??= { employeeId: null, name: 'Unassigned', open: 0, done: 0, total: 0 }
      unassigned.total += 1
      if (task.done) unassigned.done += 1
      else unassigned.open += 1
      continue
    }
    for (const assignee of task.assignees) {
      const entry = byPerson.get(assignee.employeeId) ?? {
        employeeId: assignee.employeeId,
        name: assignee.name,
        open: 0,
        done: 0,
        total: 0,
      }
      entry.total += 1
      if (task.done) entry.done += 1
      else entry.open += 1
      byPerson.set(assignee.employeeId, entry)
    }
  }
  const people = [...byPerson.values()].toSorted(
    (a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name),
  )
  return unassigned ? [...people, unassigned] : people
}

// --- activity ------------------------------------------------------------------------------------

export interface ActivityDay {
  day: string
  /** `Mon 3` under the column. */
  label: string
  due: number
  completed: number
}

/** The last `days` days to today: tasks due and tasks completed each day. */
export function activitySeries(
  tasks: readonly DashboardTask[],
  now: Date,
  days = 14,
): ActivityDay[] {
  return Array.from({ length: days }, (_, index) => {
    const date = subDays(startOfDay(now), days - 1 - index)
    const day = toDay(date)
    return {
      day,
      label: format(date, 'EEE d'),
      due: tasks.filter((task) => task.dueDate === day).length,
      completed: tasks.filter(
        (task) => task.done && task.closedAt !== null && dayOf(task.closedAt) === day,
      ).length,
    }
  })
}

export interface ActivityFigures {
  completedThisWeek: number
  completedLastWeek: number
  /** Share of closed tasks (with a due date) closed on time; null when none closed. */
  onTimePercent: number | null
  trackedMinutes: number
  storyPoints: number
}

export function activityFigures(
  tasks: readonly DashboardTask[],
  now: Date,
  meId: string | null,
): ActivityFigures {
  const lastWeek = subDays(now, 7)
  const closedWithDue = tasks.filter((task) => task.done && task.dueDate !== null)
  const onTime = closedWithDue.filter((task) => !task.isClosedLate).length
  return {
    completedThisWeek: tasks.filter((task) => completedThisWeek(task, now)).length,
    completedLastWeek: tasks.filter((task) => completedThisWeek(task, lastWeek)).length,
    onTimePercent:
      closedWithDue.length === 0 ? null : Math.round((onTime / closedWithDue.length) * 100),
    trackedMinutes: tasks.reduce((sum, task) => sum + task.timeTrackedMinutes, 0),
    storyPoints: tasks.reduce(
      (sum, task) =>
        sum +
        task.storyPoints
          .filter((entry) => meId === null || entry.employeeId === meId)
          .reduce((points, entry) => points + entry.points, 0),
      0,
    ),
  }
}

// --- latest activity, from the tasks' own dates -------------------------------------------------------

export interface TaskEvent {
  id: string
  kind: 'created' | 'completed' | 'commented'
  at: string
  task: DashboardTask
  who: string | null
  text: string | null
}

/**
 * The newest things that happened to the tasks, from what each row carries: when it was made,
 * when it was closed and its latest comment. (The workspace history endpoint is the Activity
 * view's; it is per workspace and paged.)
 */
export function latestEvents(tasks: readonly DashboardTask[], limit = 8): TaskEvent[] {
  const events: TaskEvent[] = []
  for (const task of tasks) {
    events.push({
      id: `${task.id}:created`,
      kind: 'created',
      at: task.createdAt,
      task,
      who: task.createdByName,
      text: null,
    })
    if (task.closedAt && task.done) {
      events.push({
        id: `${task.id}:completed`,
        kind: 'completed',
        at: task.closedAt,
        task,
        who: null,
        text: null,
      })
    }
    if (task.latestComment) {
      events.push({
        id: `${task.id}:commented`,
        kind: 'commented',
        at: task.latestComment.createdAt,
        task,
        who: task.latestComment.authorName,
        text: task.latestComment.body,
      })
    }
  }
  return events.toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

// --- folders and lists -------------------------------------------------------------------------------

export interface ListStat {
  id: string
  name: string
  folderId: string | null
  total: number
  done: number
  overdue: number
  percent: number
}

export interface FolderStat {
  id: string
  name: string
  lists: ListStat[]
  total: number
  done: number
  overdue: number
  percent: number
}

const percentOf = (done: number, total: number) =>
  total === 0 ? 0 : Math.round((done / total) * 100)

/** Each list's tasks (subtasks included) and how many are done. */
export function listStats(workspace: Workspace, tasks: readonly DashboardTask[]): ListStat[] {
  return workspace.items
    .filter((item) => item.kind === 'list')
    .map((item) => {
      const own = tasks.filter((task) => task.listId === item.id)
      const done = own.filter((task) => task.done).length
      return {
        id: item.id,
        name: item.name,
        folderId: item.parentId,
        total: own.length,
        done,
        overdue: own.filter((task) => task.isOverdue).length,
        percent: percentOf(done, own.length),
      }
    })
}

export function folderStats(workspace: Workspace, lists: readonly ListStat[]): FolderStat[] {
  return workspace.items
    .filter((item) => item.kind === 'folder')
    .map((folder) => {
      const own = lists.filter((list) => list.folderId === folder.id)
      const total = own.reduce((sum, list) => sum + list.total, 0)
      const done = own.reduce((sum, list) => sum + list.done, 0)
      return {
        id: folder.id,
        name: folder.name,
        lists: own,
        total,
        done,
        overdue: own.reduce((sum, list) => sum + list.overdue, 0),
        percent: percentOf(done, total),
      }
    })
}

/** The tasks of one folder's lists. */
export function folderTasks(
  workspace: Workspace,
  folderId: string,
  tasks: readonly DashboardTask[],
): DashboardTask[] {
  const listIds = new Set(
    workspace.items
      .filter((item) => item.kind === 'list' && item.parentId === folderId)
      .map((item) => item.id),
  )
  return tasks.filter((task) => task.listId !== null && listIds.has(task.listId))
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${String(count)} ${count === 1 ? one : many}`

/** The workspace a dashboard opens on: a favourite, else one the caller belongs to, else the first. */
export function defaultWorkspace(
  workspaces: readonly WorkspaceSummary[],
): WorkspaceSummary | undefined {
  return (
    workspaces.find((workspace) => workspace.favorite) ??
    workspaces.find((workspace) => workspace.myRole !== null) ??
    workspaces[0]
  )
}

/** A workspace the API refused (403) or does not have (404): shown as no access, not an error. */
export const isRefused = (status: number | undefined) => status === 403 || status === 404
