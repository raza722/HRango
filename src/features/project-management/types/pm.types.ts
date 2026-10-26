// Project Management: workspaces (Create Workspace wizard), their folders and lists, and the tasks
// of a workspace's List view, as the screens use them. The API's own shapes are in
// `api/pm.dto.ts`; `api/pm.mappers.ts` turns one into the other. Dates are `yyyy-MM-dd`, times
// `HH:mm`, instants ISO. Ids are the API's (strings).

import type { FileRef } from '@/lib/files'

/** Someone who can own, join or be assigned work (`GET /projects/people`). */
export interface PmPerson {
  id: string
  name: string
  designation: string
  department: string
  photoUrl: string | null
}

export interface PmDepartment {
  id: string
  name: string
}

export interface PmLookups {
  /** The signed-in person's employee; null for an account without one (the administrator). */
  me: PmPerson | null
  employees: PmPerson[]
}

// --- workspace setup (the wizard) ----------------------------------------------------------------

/** A workflow template's code (`work_starter`, `project_management`, ...): `GET /projects/templates`. */
export type WorkflowTemplateId = string

/** Every view the screens know; the API's `map` and `custom` views are not drawn. */
export const VIEW_KINDS = [
  'list',
  'board',
  'calendar',
  'activity',
  'team',
  'timeline',
  'table',
  'gantt',
  'workload',
  'mind-map',
] as const
export type ViewKind = (typeof VIEW_KINDS)[number]

export const STATUS_GROUPS = ['not-started', 'active', 'done', 'closed'] as const
export type StatusGroup = (typeof STATUS_GROUPS)[number]

export interface TaskStatus {
  /** The API's id; a status made in the wizard has a temporary `st_new_...` id until saved. */
  id: string
  name: string
  /** Hex colour of the status ring and chip. */
  color: string
  group: StatusGroup
}

/** A status template's code (`custom`, `content`, `kanban`, `marketing`, `scrum`). */
export type StatusTemplateId = string

export type StatusMode = 'default' | 'custom'

export const ORGANIZER_FEATURES = [
  'priority',
  'add-fields',
  'remap-subtask-due-dates',
  'multiple-assignees',
  'story-points',
  'tags',
  'time-estimate',
  'time-tracking',
  'incomplete-warnings',
  'dependencies-warnings',
  'reschedule-dependencies',
  'show-status-progress',
  'email',
  'sprint-points',
  'wip-limits',
] as const
export type OrganizerFeature = (typeof ORGANIZER_FEATURES)[number]

/** Step 3 of the wizard: what the workspace starts with. */
export interface WorkspaceSetup {
  /** Views created with the workspace; List is always one of them. */
  views: ViewKind[]
  /** The view a workspace opens on. */
  defaultView: ViewKind
  statusMode: StatusMode
  statusTemplate: StatusTemplateId | null
  statuses: TaskStatus[]
  organizer: OrganizerFeature[]
}

/** A Define Workflow card: a workflow template with what a workspace starts with. */
export interface WorkflowTemplate {
  id: WorkflowTemplateId
  name: string
  description: string
  setup: WorkspaceSetup
}

/** A "Status Templates" entry. */
export interface StatusTemplate {
  id: StatusTemplateId
  name: string
  description: string
  statuses: TaskStatus[]
}

export interface PmTemplates {
  workflows: WorkflowTemplate[]
  statusTemplates: StatusTemplate[]
}

/** Make Private (members only), Only Workspace (everyone in the company) or Public. */
export type Visibility = 'private' | 'workspace' | 'public'

/** The Create Workspace wizard's request (`POST /projects/workspaces`). */
export interface WorkspaceInput {
  name: string
  ownerId: string
  description: string
  visibility: Visibility
  /** Members besides the owner (who joins as workspace admin); they join as contributors. */
  memberIds: string[]
  departmentId: string
  template: WorkflowTemplateId
  setup: WorkspaceSetup
}

// --- workspace roles and List view columns ----------------------------------------------------

/** Workspace roles, highest first. Inside a workspace the role decides what a person may do. */
export const PM_ROLES = [
  'workspace-admin',
  'hr',
  'managers',
  'team-leaders',
  'contributors',
] as const
export type PmRole = (typeof PM_ROLES)[number]

export const TASK_COLUMN_KEYS = [
  'name',
  'assignees',
  'startDate',
  'dueDate',
  'priority',
  'tags',
  'dependencies',
  'status',
  'progress',
  'timeEstimate',
  'timeTracked',
  'taskId',
  'createdBy',
  'dateCreated',
  'dateClosed',
  'latestComment',
  'storyPoints',
  'files',
  'labels',
] as const
export type TaskColumnKey = (typeof TASK_COLUMN_KEYS)[number]

export const PERMISSION_LEVELS = ['default', 'can-edit', 'can-view', 'private'] as const
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number]

/** "Set Role Permission" on a column (`/column-permissions/{columnKey}`). */
export interface ColumnPermission {
  /** Baseline for everyone in the workspace. */
  defaultLevel: PermissionLevel
  roles: Partial<Record<PmRole, PermissionLevel>>
  members: { employeeId: string; level: PermissionLevel }[]
}

export interface ListColumn {
  key: TaskColumnKey
  visible: boolean
  permission: ColumnPermission
}

// --- workspaces ---------------------------------------------------------------------------------

export interface WorkspaceMember {
  employeeId: string
  name: string
  designation: string
  department: string
  role: PmRole
}

/** A saved view of the workspace (the wizard's views, "+ View", the List view's columns). */
export interface WorkspaceView {
  id: string
  kind: ViewKind
  name: string
  listId: string | null
  isDefault: boolean
  isRequired: boolean
  isPrivate: boolean
  ownerId: string | null
  config: Record<string, unknown> | null
  rowVersion: string
}

/** A workspace as the Workspaces panel lists it (`GET /projects/workspaces`). */
export interface WorkspaceSummary {
  id: string
  name: string
  description: string
  visibility: Visibility
  departmentId: string | null
  departmentName: string | null
  ownerId: string
  ownerName: string | null
  /** The caller's workspace role; null when they read a workspace they are not a member of. */
  myRole: PmRole | null
  favorite: boolean
  hidden: boolean
  memberCount: number
  /** Banner image; null draws the design's default. */
  cover: FileRef | null
  createdAt: string
  rowVersion: string
}

export type WorkspaceItemKind = 'folder' | 'list'

/** A folder or list in a workspace ("Workspace Navigation"). */
export interface WorkspaceItem {
  id: string
  workspaceId: string
  /** The folder a list sits in; null at the workspace's top level (folders are always there). */
  parentId: string | null
  kind: WorkspaceItemKind
  name: string
  order: number
  rowVersion: string
}

/** One workspace with everything its page needs (`GET /projects/workspaces/{id}` + column permissions). */
export interface Workspace extends WorkspaceSummary {
  template: WorkflowTemplateId
  templateName: string
  setup: WorkspaceSetup
  members: WorkspaceMember[]
  /** Owner and members, owner first. */
  memberIds: string[]
  views: WorkspaceView[]
  items: WorkspaceItem[]
  /** List view columns, in order, with their permissions. */
  columns: ListColumn[]
  /** Levels in effect for the caller on columns that have any permission set. */
  myLevels: Partial<Record<TaskColumnKey, PermissionLevel>>
  /** The Labels column's custom field (type labels), when the workspace has one. */
  labelsFieldId: string | null
}

export interface WorkspaceTree {
  workspaces: WorkspaceSummary[]
}

/** What the workspace page can change on its workspace. */
export interface WorkspacePatch {
  name?: string
  description?: string
  visibility?: Visibility
  favorite?: boolean
  /** Adds people as contributors (Invite Members). */
  addMemberIds?: string[]
  columns?: ListColumn[]
  /** A view added from "+ View". */
  addView?: ViewKind
}

// --- tasks ------------------------------------------------------------------------------------------

export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export type TaskType = 'task' | 'milestone'

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export interface Recurrence {
  every: number
  unit: RecurrenceUnit
  /** 0 = Sunday … 6 = Saturday ("Repeat On"). */
  weekdays: number[]
  ends: { kind: 'never' } | { kind: 'on'; date: string } | { kind: 'after'; count: number }
}

/** A time entry (`/tasks/{id}/time-entries`), in local time. */
export interface TimeEntry {
  id: string
  employeeId: string
  employeeName: string
  date: string
  start: string
  /** Null while the timer runs. */
  end: string | null
  minutes: number
  notes: string
  isRunning: boolean
  /** When it started (ISO), for the running timer. */
  startAt: string
  rowVersion: string
}

/** A new manual entry: a day with a start and stop, or a length ending now. */
export type TimeEntryInput =
  { date: string; start: string; end: string; notes: string } | { minutes: number; notes: string }

export interface StoryPoint {
  employeeId: string
  points: number
}

/** A file attached to a task (`/tasks/{id}/attachments`). */
export interface Attachment {
  id: string
  fileId: string
  name: string
  mimeType: string | null
  /** File size in bytes. */
  size: number
  uploadedByName: string | null
  uploadedAt: string
  /** Signed download link (expires). */
  url: string
}

export interface TaskAssignee {
  employeeId: string
  name: string
  storyPoints: number | null
}

export interface Task {
  id: string
  /** Task ID column, `HR000000001`. */
  code: string
  workspaceId: string
  /** The list it belongs to; null for a task at the workspace's top level. */
  listId: string | null
  listName: string | null
  /** The parent task of a subtask. */
  parentId: string | null
  name: string
  description: string
  statusId: string
  type: TaskType
  assigneeIds: string[]
  assignees: TaskAssignee[]
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  isOverdue: boolean
  recurrence: Recurrence | null
  priority: Priority | null
  tagIds: string[]
  /** Option ids of the workspace's Labels field (`<fieldId>:<option>`). */
  labelIds: string[]
  storyPoints: StoryPoint[]
  /** Story point rating: 1 Fair, 2 Good, 3 Excellent Results; 0 none. */
  rating: number
  timeEstimateMinutes: number | null
  timeTrackedMinutes: number
  attachmentCount: number
  /** Open tasks this one waits on. */
  openDependencyCount: number
  /** Tasks waiting on this one. */
  blockingCount: number
  favorite: boolean
  createdByName: string | null
  createdAt: string
  closedAt: string | null
  order: number
  cover: FileRef | null
  rowVersion: string
}

/** Add Task (`POST /projects/tasks`). */
export interface TaskInput {
  workspaceId: string
  listId: string | null
  parentId: string | null
  name: string
  statusId?: string | undefined
  type?: TaskType | undefined
}

/** What the List view can change on a task; the API layer sends each part to its endpoint. */
export type TaskPatch = Partial<
  Pick<
    Task,
    | 'name'
    | 'description'
    | 'type'
    | 'priority'
    | 'startDate'
    | 'startTime'
    | 'dueDate'
    | 'dueTime'
    | 'recurrence'
    | 'rating'
    | 'timeEstimateMinutes'
    | 'statusId'
    | 'assigneeIds'
    | 'storyPoints'
    | 'tagIds'
    | 'labelIds'
    | 'listId'
    | 'parentId'
    | 'order'
    | 'favorite'
  >
>

/** A task as the List view draws it. */
export interface TaskRow extends Task {
  subtaskCount: number
  commentCount: number
  latestComment: { authorName: string | null; body: string; createdAt: string } | null
}

export type DependencyKind = 'waiting_on' | 'blocking' | 'linked'

export interface TaskDependency {
  id: string
  kind: DependencyKind
  taskId: string
  code: string
  name: string
  statusName: string
  statusColor: string | null
}

/** The task screen (`GET /projects/tasks/{id}`): the row plus its links. */
export interface TaskDetail extends TaskRow {
  myRole: PmRole | null
  dependencies: TaskDependency[]
  /** Ids of tasks it waits on / blocks. */
  waitingOn: string[]
  blocking: string[]
  hiddenColumns: string[]
}

/** The List view's rows and what the caller may not see. */
export interface TaskList {
  rows: TaskRow[]
  /** Columns that are Private Fields for the caller (API keys). */
  hiddenColumns: string[]
}

// --- comments, tags, reminders, sharing ---------------------------------------------------------------

export interface TaskComment {
  id: string
  taskId: string
  /** The comment this one replies to. */
  parentId: string | null
  authorId: string
  authorName: string
  body: string
  createdAt: string
  editedAt: string | null
  assignedToId: string | null
  assignedToName: string | null
  assignedById: string | null
  assignedByName: string | null
  resolved: boolean
  resolvedById: string | null
  resolvedByName: string | null
  /** People who reacted with a like. */
  likedByIds: string[]
  /** Other reactions (emoji) by person. */
  reactions: { employeeId: string; reaction: string }[]
  rowVersion: string
}

export interface CommentInput {
  body: string
  parentId?: string | null | undefined
  assignedToId?: string | null | undefined
}

/** One change at a time: the text, the assignee, resolved, or the caller's like. */
export interface CommentPatch {
  body?: string
  assignedToId?: string | null
  resolved?: boolean
  /** Sets or removes the caller's like. */
  liked?: boolean
}

export type TagKind = 'tag' | 'label'

/** A tag, or an option of the workspace's Labels field (kind `label`). */
export interface Tag {
  id: string
  workspaceId: string
  kind: TagKind
  name: string
  color: string
  rowVersion: string | null
}

export interface TagInput {
  kind: TagKind
  name: string
  color: string
}

/** The caller's "Remind Me" on a task (`/projects/reminders`). */
export interface Reminder {
  id: string
  remindAt: string
  rowVersion: string
}

export type ShareEntity = 'task' | 'task_list' | 'workspace'

export type ShareAccess = 'full_edit' | 'limited' | 'commenter'

/** "Sharing & Permissions" of a task or list (`/projects/shares`). */
export interface ShareSettings {
  /** Null until saved once. */
  id: string | null
  entityType: ShareEntity
  entityId: string
  scope: 'list' | 'page'
  people: { employeeId: string; access: ShareAccess }[]
  /** People outside the directory, by email (Limited access). */
  invitedEmails: string[]
  /** "Share link with anyone". */
  linkEnabled: boolean
  /** The private link's address (no page serves it yet). */
  link: string | null
  validFrom: string | null
  validTo: string | null
  maxAccess: number | null
  allowOpeningTasks: boolean
  /** Task properties shown to people the link is shared with (API codes). */
  properties: string[]
  rowVersion: string | null
}
