// Project Management: workspaces (Create Workspace wizard), their folders, lists and docs, and
// the tasks of a workspace's List view. Dates are `yyyy-MM-dd`, times `HH:mm`, instants ISO.

/** Someone who can own, join or be assigned work: the company directory. */
export interface PmPerson {
  id: string
  name: string
  designation: string
  department: string
  photoUrl: string | null
}

export interface PmLookups {
  me: PmPerson
  employees: PmPerson[]
  departments: string[]
}

// --- workspace setup (the wizard) ----------------------------------------------------------------

export const WORKFLOW_TEMPLATES = [
  'work-starter',
  'project-management',
  'marketing-team',
  'product-engineering',
] as const
export type WorkflowTemplateId = (typeof WORKFLOW_TEMPLATES)[number]

/** Every view a workspace can have; the wizard's Default Views page switches them. */
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
  id: string
  name: string
  /** Hex colour of the status ring and chip. */
  color: string
  group: StatusGroup
}

export const STATUS_TEMPLATES = ['custom', 'content', 'kanban', 'marketing', 'scrum'] as const
export type StatusTemplateId = (typeof STATUS_TEMPLATES)[number]

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
  statusTemplate: StatusTemplateId
  statuses: TaskStatus[]
  organizer: OrganizerFeature[]
}

/** Make Private (invited members), Only Workspace (everyone in the company) or Public. */
export type Visibility = 'private' | 'workspace' | 'public'

export interface WorkspaceInput {
  name: string
  ownerId: string
  description: string
  visibility: Visibility
  /** Members of a private workspace (the owner is always a member). */
  memberIds: string[]
  department: string
  template: WorkflowTemplateId
  setup: WorkspaceSetup
}

// --- List view columns and permissions ----------------------------------------------------------

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

export const PM_ROLES = [
  'workspace-admin',
  'hr',
  'managers',
  'team-leaders',
  'contributors',
] as const
export type PmRole = (typeof PM_ROLES)[number]

/** "Set Role Permission" on a column. */
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

// --- workspaces and their tree --------------------------------------------------------------------

export interface Workspace extends WorkspaceInput {
  id: string
  /** Banner image (a CSS gradient key or an uploaded data URL); null draws the default. */
  coverUrl: string | null
  favorite: boolean
  createdById: string
  createdAt: string
  /** List view columns, in order. */
  columns: ListColumn[]
}

export type WorkspaceItemKind = 'folder' | 'list' | 'doc'

/** A folder, list or doc in a workspace ("Workspace Navigation"). */
export interface WorkspaceItem {
  id: string
  workspaceId: string
  /** The folder it sits in; null at the workspace's top level. */
  parentId: string | null
  kind: WorkspaceItemKind
  name: string
  favorite: boolean
  order: number
}

export interface WorkspaceTree {
  workspaces: Workspace[]
  items: WorkspaceItem[]
}

export interface WorkspaceItemInput {
  kind: WorkspaceItemKind
  name: string
  parentId: string | null
}

export type WorkspacePatch = Partial<
  Pick<
    Workspace,
    'name' | 'description' | 'coverUrl' | 'favorite' | 'memberIds' | 'visibility' | 'columns'
  >
> & { setup?: Partial<WorkspaceSetup> }

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

export interface TimeEntry {
  id: string
  employeeId: string
  date: string
  start: string
  end: string
  minutes: number
  notes: string
}

export interface StoryPoint {
  employeeId: string
  points: number
}

export type AttachmentSource =
  'device' | 'google-drive' | 'google-docs' | 'dropbox' | 'box' | 'onedrive'

export interface Attachment {
  id: string
  name: string
  /** File size in bytes. */
  size: number
  source: AttachmentSource
  uploadedById: string
  uploadedAt: string
}

export interface Task {
  id: string
  /** Task ID column, `#HR000000001`. */
  code: string
  workspaceId: string
  /** The list it belongs to; null for a task at the workspace's top level. */
  listId: string | null
  /** The parent task of a subtask. */
  parentId: string | null
  name: string
  description: string
  statusId: string
  type: TaskType
  assigneeIds: string[]
  /** People invited by email from Add Assignee ("Invite from email"). */
  invitedEmails: string[]
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  recurrence: Recurrence | null
  priority: Priority | null
  tagIds: string[]
  labelIds: string[]
  /** Tasks that must be completed before this one. */
  waitingOn: string[]
  /** Tasks that can't start until this one is completed. */
  blocking: string[]
  storyPoints: StoryPoint[]
  /** Story point rating: 1 Fair, 2 Good, 3 Excellent Results; 0 none. */
  rating: number
  timeEstimateMinutes: number | null
  timeEntries: TimeEntry[]
  /** The running timer's start, if one is running. */
  timerStartedAt: string | null
  attachments: Attachment[]
  /** "Remind Me" instant. */
  reminderAt: string | null
  favorite: boolean
  createdById: string
  createdAt: string
  closedAt: string | null
  order: number
}

export interface TaskInput {
  workspaceId: string
  listId: string | null
  parentId: string | null
  name: string
  statusId?: string | undefined
}

export type TaskPatch = Partial<
  Omit<Task, 'id' | 'code' | 'workspaceId' | 'createdById' | 'createdAt' | 'closedAt'>
>

/** A task as the List view draws it: names resolved for the read-only columns. */
export interface TaskRow extends Task {
  subtaskCount: number
  commentCount: number
  latestComment: { authorId: string; body: string; createdAt: string } | null
}

// --- comments, tags, sharing ----------------------------------------------------------------------

export interface TaskComment {
  id: string
  taskId: string
  /** The comment this one replies to. */
  parentId: string | null
  authorId: string
  body: string
  createdAt: string
  editedAt: string | null
  assignedToId: string | null
  assignedById: string | null
  resolved: boolean
  resolvedById: string | null
  likedByIds: string[]
}

export interface CommentInput {
  body: string
  parentId?: string | null | undefined
  assignedToId?: string | null | undefined
}

export type CommentPatch = Partial<
  Pick<TaskComment, 'body' | 'assignedToId' | 'resolved' | 'likedByIds'>
>

export type TagKind = 'tag' | 'label'

export interface Tag {
  id: string
  workspaceId: string
  kind: TagKind
  name: string
  color: string
}

export interface TagInput {
  kind: TagKind
  name: string
  color: string
}

export type ShareAccess = 'full-edit' | 'edit' | 'view'

/** "Sharing & Permissions" of a task or list. */
export interface ShareSettings {
  targetId: string
  scope: 'list' | 'page'
  people: { employeeId: string; access: ShareAccess }[]
  invitedEmails: string[]
  linkEnabled: boolean
  validFrom: string | null
  validTo: string | null
  maxAccess: number | null
  allowOpeningTasks: boolean
  /** Task properties shown to people the link is shared with. */
  properties: string[]
}
