import {
  addDays,
  addHours,
  addMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSaturday,
  isSunday,
  nextMonday,
  nextSaturday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { z } from 'zod'

import type {
  Priority,
  StoryPoint,
  Task,
  TaskPatch,
  TimeEntry,
  Workspace,
} from '../../types/pm.types'

// --- dates ----------------------------------------------------------------------------------------

/** A calendar day as the API stores it. */
export const toDay = (date: Date): string => format(date, 'yyyy-MM-dd')
export const fromDay = (day: string): Date => parseISO(day)
export const toTime = (date: Date): string => format(date, 'HH:mm')

/** The List view's date cells: `4/16/2025`. */
export const formatCellDate = (day: string): string => format(fromDay(day), 'M/d/yyyy')

/** `17:22` → `5:22 PM`. */
export function formatTime12(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)
  return format(date, 'h:mm a')
}

export interface QuickPick {
  key: string
  label: string
  date: string
  /** Set only by "Later", which also picks the time. */
  time: string | null
  /** What the row shows on the right: a weekday, a time or a day and month. */
  hint: string
}

/**
 * The calendar's shortcuts (1:26874) in their three groups: Today / Tomorrow / Later,
 * This Weekend / Next Week / Next Weekend, 2 Weeks / 4 Weeks.
 */
export function quickPicks(now: Date): QuickPick[][] {
  const weekday = (date: Date) => format(date, 'EEE')
  const dayMonth = (date: Date) => format(date, 'd MMM')
  const pick = (key: string, label: string, date: Date, hint: string): QuickPick => ({
    key,
    label,
    date: toDay(date),
    time: null,
    hint,
  })
  const later = addHours(now, LATER_HOURS)
  const saturday = isSaturday(now) ? now : nextSaturday(now)
  const thisWeekend = isSunday(now) ? now : saturday
  const nextWeekend = isSunday(now) ? saturday : addDays(saturday, 7)
  const tomorrow = addDays(now, 1)
  const nextWeek = nextMonday(now)
  const twoWeeks = addDays(now, 14)
  const fourWeeks = addDays(now, 28)
  return [
    [
      pick('today', 'Today', now, weekday(now)),
      pick('tomorrow', 'Tomorrow', tomorrow, weekday(tomorrow)),
      { ...pick('later', 'Later', later, format(later, 'h:mm a')), time: toTime(later) },
    ],
    [
      pick('this-weekend', 'This Weekend', thisWeekend, weekday(thisWeekend)),
      pick('next-week', 'Next Week', nextWeek, weekday(nextWeek)),
      pick('next-weekend', 'Next Weekend', nextWeekend, dayMonth(nextWeekend)),
    ],
    [
      pick('two-weeks', '2 Weeks', twoWeeks, dayMonth(twoWeeks)),
      pick('four-weeks', '4 Weeks', fourWeeks, dayMonth(fourWeeks)),
    ],
  ]
}

/** "Later" is later today: this many hours from now. */
export const LATER_HOURS = 4

/** The days a month view shows, whole weeks from Sunday (the design's April 2025 starts 30 Mar). */
export function monthDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

// --- 12-hour clock (Add Time popup 1:15113) -----------------------------------------------------

export type Meridiem = 'AM' | 'PM'

export interface Clock12 {
  /** 1 to 12. */
  hour: number
  minute: number
  meridiem: Meridiem
}

export function toClock12(time: string): Clock12 {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: minutes,
    meridiem: hours < 12 ? 'AM' : 'PM',
  }
}

export function fromClock12({ hour, minute, meridiem }: Clock12): string {
  const hours = (hour % 12) + (meridiem === 'PM' ? 12 : 0)
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** The time the Add Time popup starts at when none is set: the next full hour. */
export function nextFullHour(now = new Date()): string {
  const next = addMinutes(now, 60 - now.getMinutes())
  return `${String(next.getHours()).padStart(2, '0')}:00`
}

// --- durations ----------------------------------------------------------------------------------

const UNIT_MINUTES: Record<string, number> = {
  h: 60,
  hr: 60,
  hrs: 60,
  hour: 60,
  hours: 60,
  m: 1,
  min: 1,
  mins: 1,
  minute: 1,
  minutes: 1,
}

/**
 * Reads a typed duration ("3h 30min", "3h", "45min", "1.5h", "3:30", or plain minutes "90").
 * Null when the text is not a duration or comes to nothing.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase()
  if (!value) return null
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value)
  if (clock) return positive(Number(clock[1]) * 60 + Number(clock[2]))
  if (/^\d+$/.test(value)) return positive(Number(value))
  const part = /(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|minutes|minute|mins|min|m)(?![a-z])/g
  let total = 0
  const rest = value.replace(part, (_match, amount: string, unit: string) => {
    total += Number(amount) * (UNIT_MINUTES[unit] ?? 0)
    return ' '
  })
  if (rest.replace(/[\s,]+/g, '') !== '') return null
  return positive(Math.round(total))
}

const positive = (minutes: number) => (minutes > 0 ? minutes : null)

/** As the design writes durations: `127` → `2hr 7min`, `45` → `45min`, `120` → `2hr`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}min`
  return rest === 0 ? `${hours}hr` : `${hours}hr ${rest}min`
}

/** The timer's read-out: `00 : 01 : 03`. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))} : ${pad(Math.floor((seconds % 3600) / 60))} : ${pad(seconds % 60)}`
}

export const minutesOf = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Every quarter hour of a day, `00:00` to `23:45` (the Start Time / Stop Time lists). */
export const QUARTER_TIMES: readonly string[] = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/** `09:15` → `9:15 am`, as the time option layers read. */
export function formatTimeOption(time: string): string {
  return formatTime12(time).toLowerCase()
}

export const trackedMinutes = (task: Pick<Task, 'timeEntries'>): number =>
  task.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0)

/** Time entries grouped by person, the person with the latest entry first. */
export function entriesByPerson(entries: readonly TimeEntry[]) {
  const groups = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const list = groups.get(entry.employeeId) ?? []
    list.push(entry)
    groups.set(entry.employeeId, list)
  }
  return [...groups.entries()].map(([employeeId, list]) => ({
    employeeId,
    entries: list.toSorted((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)),
    minutes: list.reduce((sum, entry) => sum + entry.minutes, 0),
  }))
}

export const TIME_NOTES_MAX = 165

/** The manual time entry form: Select Day & Date, Start Time, Stop Time, notes. */
export const timeEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day'),
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Choose the start time'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Choose the stop time'),
    notes: z.string().max(TIME_NOTES_MAX, `Keep notes to ${TIME_NOTES_MAX} characters`),
  })
  .refine((entry) => !entry.start || !entry.end || entry.end > entry.start, {
    path: ['end'],
    message: 'The stop time must be after the start time',
  })
export type TimeEntryForm = z.infer<typeof timeEntrySchema>

export const newEntryId = (): string =>
  `te_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** A timer run from `startedAt` to `now` as a time entry (at least a minute). */
export function timerEntry(employeeId: string, startedAt: string, now: Date): TimeEntry {
  const start = parseISO(startedAt)
  const minutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60_000))
  return {
    id: newEntryId(),
    employeeId,
    date: toDay(start),
    start: toTime(start),
    end: toTime(now),
    minutes,
    notes: '',
  }
}

/** A typed duration as an entry that ends now (it starts earlier the same day when it fits). */
export function manualEntry(employeeId: string, minutes: number, now: Date): TimeEntry {
  const end = toTime(now)
  const startMinutes = Math.max(0, minutesOf(end) - minutes)
  return {
    id: newEntryId(),
    employeeId,
    date: toDay(now),
    start: `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`,
    end,
    minutes,
    notes: '',
  }
}

// --- statuses and progress ----------------------------------------------------------------------

export function isClosedStatus(workspace: Workspace, statusId: string): boolean {
  const group = workspace.setup.statuses.find((status) => status.id === statusId)?.group
  return group === 'closed' || group === 'done'
}

/** Progress Bar: the share of subtasks closed; without subtasks, 100 once the task is closed. */
export function taskProgress(
  task: Task,
  tasks: readonly Task[],
  workspace: Workspace,
): { done: number; total: number; percent: number } {
  const subtasks = tasks.filter((other) => other.parentId === task.id)
  if (subtasks.length === 0) {
    const closed = isClosedStatus(workspace, task.statusId)
    return { done: closed ? 1 : 0, total: 1, percent: closed ? 100 : 0 }
  }
  const done = subtasks.filter((other) => isClosedStatus(workspace, other.statusId)).length
  return { done, total: subtasks.length, percent: Math.round((done / subtasks.length) * 100) }
}

/** Time Estimate's "Total with Subtask": the task's estimate plus its subtasks'. */
export function estimateWithSubtasks(task: Task, tasks: readonly Task[]): number {
  return tasks
    .filter((other) => other.parentId === task.id)
    .reduce((sum, other) => sum + (other.timeEstimateMinutes ?? 0), task.timeEstimateMinutes ?? 0)
}

// --- story points ---------------------------------------------------------------------------------

export const storyPointTotal = (points: readonly StoryPoint[]): number =>
  points.reduce((sum, entry) => sum + entry.points, 0)

/**
 * The Story Points column footer ("Average Story Points"): the mean of each task's total over
 * the tasks that have story points. Null when none has.
 */
export function averageStoryPoints(tasks: readonly Pick<Task, 'storyPoints'>[]): number | null {
  const totals = tasks
    .filter((task) => task.storyPoints.length > 0)
    .map((task) => storyPointTotal(task.storyPoints))
  if (totals.length === 0) return null
  return Math.round((totals.reduce((sum, total) => sum + total, 0) / totals.length) * 10) / 10
}

export const RATING_LABELS = ['Fair Results', 'Good Results', 'Excellent Results'] as const

// --- priority -----------------------------------------------------------------------------------

/**
 * The flags' colours as the design draws them: Urgent in Danger Colors/600 (the Set Priority
 * cell), High orange, Normal blue, Low dark grey (1:27555).
 */
export const PRIORITY_FLAG_COLORS: Record<Priority, string> = {
  urgent: '#DC3545',
  high: '#F79009',
  normal: '#2E64E2',
  low: '#626262',
}

// --- dependencies ---------------------------------------------------------------------------------

export type DependencyRelation = 'waitingOn' | 'blocking'

export const OTHER_SIDE: Record<DependencyRelation, DependencyRelation> = {
  waitingOn: 'blocking',
  blocking: 'waitingOn',
}

export interface TaskUpdate {
  id: string
  patch: TaskPatch
}

type Links = Pick<Task, 'id' | 'waitingOn' | 'blocking'>

const withId = (ids: readonly string[], id: string) => (ids.includes(id) ? [...ids] : [...ids, id])
const withoutId = (ids: readonly string[], id: string) => ids.filter((other) => other !== id)

/**
 * Both sides of a link: `task` waiting on `other` also puts `task` in `other`'s Blocking, and
 * the other way round.
 */
export function linkUpdates(task: Links, other: Links, relation: DependencyRelation): TaskUpdate[] {
  const back = OTHER_SIDE[relation]
  return [
    { id: task.id, patch: { [relation]: withId(task[relation], other.id) } },
    { id: other.id, patch: { [back]: withId(other[back], task.id) } },
  ]
}

export function unlinkUpdates(
  task: Links,
  other: Links | undefined,
  relation: DependencyRelation,
  otherId: string,
): TaskUpdate[] {
  const back = OTHER_SIDE[relation]
  const updates: TaskUpdate[] = [
    { id: task.id, patch: { [relation]: withoutId(task[relation], otherId) } },
  ]
  if (other) updates.push({ id: other.id, patch: { [back]: withoutId(other[back], task.id) } })
  return updates
}

/** Tasks this one waits on that are not closed yet: the name's warning icon. */
export function openBlockers<T extends Task>(
  task: Task,
  tasks: readonly T[],
  workspace: Workspace,
): T[] {
  return task.waitingOn
    .map((id) => tasks.find((other) => other.id === id))
    .filter((other): other is T => other !== undefined)
    .filter((other) => !isClosedStatus(workspace, other.statusId))
}

// --- files ----------------------------------------------------------------------------------------

export type FileKind = 'pdf' | 'xls' | 'jpg' | 'doc' | 'file'

export function fileKind(name: string): FileKind {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? ''
  if (extension === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'xls'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'jpg'
  if (['doc', 'docx', 'rtf', 'txt'].includes(extension)) return 'doc'
  return 'file'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Largest file the Files popup takes (the mock keeps only the file's details). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export const newAttachmentId = (): string =>
  `at_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// --- assignees ------------------------------------------------------------------------------------

export const inviteEmailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email address')
  .pipe(z.email('Enter a valid email address'))

/** Avatars the Add Assignee cell draws before its "+n" chip. */
export const VISIBLE_AVATARS = 4

/** Rows "Added Assignees" shows before "View more". */
export const ADDED_PREVIEW = 3

// --- links ----------------------------------------------------------------------------------------

/** The address a task's link icon copies: its workspace list, with the task as the hash. */
export function taskLink(task: Pick<Task, 'id' | 'workspaceId' | 'listId'>, origin: string) {
  const list = task.listId ? `?list=${encodeURIComponent(task.listId)}` : ''
  return `${origin}/project-management/workspaces/${task.workspaceId}${list}#${task.id}`
}

// --- dependency roll-ups --------------------------------------------------------------------------

/** "Add a Roll-up Dropdown Menu": the linked tasks' fields the Dependencies popup can show. */
export const ROLLUP_COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'assignees', label: 'Assignees' },
  { key: 'taskId', label: 'Task ID' },
  { key: 'priority', label: 'Priority' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'dateCreated', label: 'Date Created' },
  { key: 'dateClosed', label: 'Date Closed' },
  { key: 'timeEstimate', label: 'Time Estimate' },
  { key: 'timeTracked', label: 'Time Tracked' },
] as const
export type RollupColumn = (typeof ROLLUP_COLUMNS)[number]['key']
