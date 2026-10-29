// The API's shapes under `/projects` (backend `app/schemas/projects*.py`), camelCase as sent.
// The mock API (src/mocks/project-management) answers with the same shapes.

import type { FileRef } from '@/lib/files'
import type { PaginationMeta } from '@/types/api'

export type ApiStatusGroup = 'not_started' | 'active' | 'done' | 'closed'
export type ApiWorkspaceRole = 'workspace_admin' | 'hr' | 'manager' | 'team_leader' | 'contributor'
export type ApiPermissionLevel = 'default' | 'can_edit' | 'can_view' | 'private'
export type ApiViewType =
  | 'list'
  | 'board'
  | 'calendar'
  | 'map'
  | 'activity'
  | 'team'
  | 'table'
  | 'timeline'
  | 'gantt'
  | 'mind_map'
  | 'workload'
  | 'custom'
export type ApiFeatureCode =
  | 'priority'
  | 'sprints'
  | 'email'
  | 'tags'
  | 'custom_fields'
  | 'multiple_assignees'
  | 'time_tracking'
  | 'time_estimate'
  | 'remap_subtask_due_dates'
  | 'wip_limits'
  | 'story_points'
  | 'incomplete_warning'
  | 'dependency_warning'
  | 'reschedule_dependencies'
  | 'show_status_progress'
export type ApiPrivacy = 'private' | 'workspace' | 'public'
export type ApiPriority = 'urgent' | 'high' | 'normal' | 'low'

// --- templates, people ---------------------------------------------------------------------------

export interface TemplateDto {
  id: string
  code: string
  name: string
  description: string | null
  views: { viewType: string; name: string; isDefault: boolean }[]
  statuses: { name: string; color: string | null; statusGroup: string }[]
  features: { featureCode: string; name: string }[]
}

export interface PersonDto {
  id: string
  code: string | null
  name: string
  designationName: string | null
  departmentName: string | null
  photoFileId: string | null
  photoUrl: string | null
  memberRole: string | null
}

export interface LookupItemDto {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

// --- workspaces -----------------------------------------------------------------------------------

export interface StatusDto {
  id: string
  name: string
  color: string | null
  statusGroup: string
  sortOrder: number | null
  wipLimit: number | null
}

export interface FeatureDto {
  featureCode: string
  settingValue: string | null
}

export interface MemberDto {
  employeeId: string
  name: string
  designationName: string | null
  departmentName: string | null
  memberRole: string
}

export interface ViewDto {
  id: string
  taskListId: string | null
  viewType: string
  name: string
  config: Record<string, unknown> | null
  isPinned: boolean
  isPrivate: boolean
  isProtected: boolean
  isDefault: boolean
  isRequired: boolean
  sortOrder: number | null
  ownerId: string | null
  rowVersion: string
}

export interface FolderDto {
  id: string
  name: string
  sortOrder: number | null
  rowVersion: string
}

export interface ListDto {
  id: string
  folderId: string | null
  name: string
  privacy: string | null
  color: string | null
  description: string | null
  startAt: string | null
  endAt: string | null
  priority: string | null
  sortOrder: number | null
  taskCount: number
  closedCount: number
  progressPercent: number
  lastModifiedAt: string | null
  memberIds: string[]
  rowVersion: string
}

export interface WorkspaceSummaryDto {
  id: string
  name: string
  description: string | null
  privacy: string
  departmentId: string | null
  departmentName: string | null
  ownerId: string
  ownerName: string | null
  myRole: string | null
  isFavorite: boolean
  isHidden: boolean
  memberCount: number
  coverFileId?: string | null
  cover?: FileRef | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface WorkspaceDto extends WorkspaceSummaryDto {
  workflowTemplate: string
  workflowTemplateName: string
  statusMode: string
  statusTemplate: string | null
  statuses: StatusDto[]
  features: FeatureDto[]
  members: MemberDto[]
  views: ViewDto[]
  folders: FolderDto[]
  lists: ListDto[]
}

export interface StatusInDto {
  id?: number | string | null
  name: string
  color: string | null
  statusGroup: ApiStatusGroup
  wipLimit?: number | null
}

export interface WorkspaceCreateDto {
  name: string
  description: string | null
  privacy: ApiPrivacy
  ownerId: number | string
  departmentId: number | string
  workflowTemplate: string
  statusMode: 'default' | 'custom'
  statusTemplate: string | null
  statuses: StatusInDto[]
  views: { viewType: ApiViewType; isDefault: boolean }[]
  features: { featureCode: ApiFeatureCode; settingValue?: string | null }[]
  members: { employeeId: number | string; memberRole?: ApiWorkspaceRole }[]
}

export interface WorkspaceUpdateDto {
  name: string
  description: string | null
  privacy: ApiPrivacy
  ownerId: number | string
  departmentId: number | string
  rowVersion: string
}

// --- column permissions, custom fields, tags, favourites ----------------------------------------------

export interface ColumnPermissionDto {
  columnKey: string
  defaultLevel: string
  roles: { memberRole: string; permissionLevel: string }[]
  members: { employeeId: string; employeeName: string | null; permissionLevel: string }[]
}

export interface ColumnPermissionsDto {
  columns: ColumnPermissionDto[]
  myLevels: Record<string, string>
}

export interface ColumnPermissionInDto {
  defaultLevel: ApiPermissionLevel
  roles: { memberRole: ApiWorkspaceRole; permissionLevel: ApiPermissionLevel }[]
  members: { employeeId: number | string; permissionLevel: ApiPermissionLevel }[]
}

export interface CustomFieldDto {
  id: string
  workspaceId: string
  name: string
  fieldType: string
  description: string | null
  config: Record<string, unknown> | null
  sortOrder: number | null
  rowVersion: string
}

export interface TagDto {
  id: string
  workspaceId: string
  name: string
  color: string | null
  taskCount: number
  rowVersion: string
}

export interface FavoriteDto {
  id: string
  entityType: string
  entityId: string
  kind: string
  name: string
  workspaceId: string
  createdAt: string
}

// --- tasks -------------------------------------------------------------------------------------------

export interface RecurrenceDto {
  every: number
  unit: 'day' | 'week' | 'month' | 'year'
  weekdays: number[]
  ends: 'never' | 'on' | 'after'
  endDate: string | null
  count: number | null
}

export interface TaskRowDto {
  id: string
  workspaceId: string
  taskListId: string | null
  listName: string | null
  parentTaskId: string | null
  parentName: string | null
  code: string | null
  name: string
  description: string | null
  taskType: string
  statusId: string
  statusName: string
  statusColor: string | null
  statusGroup: string
  priority: string | null
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  originalDueDate: string | null
  isOverdue: boolean | null
  timeEstimateMinutes: number | null
  timeTrackedMinutes: number | null
  storyPointsTotal: number | null
  rating: number | null
  url: string | null
  recurrence: RecurrenceDto | null
  closedAt: string | null
  isClosedLate: boolean
  sortOrder: number | null
  createdByUserId: string | null
  createdByName: string | null
  createdAt: string | null
  updatedAt: string | null
  subtaskCount: number
  openSubtaskCount: number
  commentCount: number
  attachmentCount: number | null
  openDependencyCount: number | null
  blockingCount: number | null
  checklistCount: number
  checklistDoneCount: number
  latestComment: { body: string; authorName: string | null; createdAt: string } | null
  assignees: { employeeId: string; name: string; storyPoints: number | null }[]
  tags: { id: string; name: string; color: string | null }[]
  fieldValues: { customFieldId: string; fieldValue: string | null }[]
  coverFileId?: string | null
  cover?: FileRef | null
  rowVersion: string
  groupKey?: string | null
  groupName?: string | null
  depth?: number
  rootId?: string | null
}

export interface DependencyDto {
  id: string
  kind: string
  taskId: string
  code: string
  name: string
  statusName: string
  statusColor: string | null
  statusGroup: string
}

export interface TaskDto extends TaskRowDto {
  myRole: string | null
  isFavorite: boolean
  dependencies: DependencyDto[]
  checklist: unknown[]
  subtasks: unknown[]
  extensions: ExtensionDto[]
  hiddenColumns: string[]
}

/** `ActivityOut`: one line of a workspace's history (`GET /workspaces/{id}/activity`). */
export interface ActivityDto {
  id: string
  entityType: string
  entityId: string
  itemCode: string | null
  itemName: string | null
  actionName: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  performedByUserId: string | null
  performedByName: string | null
  performedAt: string
}

/** `ExtensionOut`: a request to move a task's due date (one per task, decided by a manager). */
export interface ExtensionDto {
  id: string
  requestedById: string
  requestedByName: string
  oldDueDate: string | null
  newDueDate: string
  reason: string | null
  /** pending | approved | rejected. */
  status: string
  decidedById: string | null
  decidedByName: string | null
  decidedAt: string | null
  remarks: string | null
  createdAt: string
  rowVersion: string
}

export interface TaskPageDto {
  data: TaskRowDto[]
  meta: PaginationMeta
  groups: { key: string; name: string; count: number }[]
  hiddenColumns: string[]
}

/** The task's own fields, replaced as a whole (`PUT /tasks/{id}`). */
export interface TaskFieldsDto {
  name: string
  description: string | null
  taskType: 'task' | 'milestone'
  priority: ApiPriority | null
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  timeEstimateMinutes: number | null
  rating: number | null
  url: string | null
  recurrence: RecurrenceDto | null
}

// --- collaboration -----------------------------------------------------------------------------------

export interface CommentDto {
  id: string
  taskId: string
  parentId: string | null
  authorId: string
  authorName: string
  body: string
  assignedToId: string | null
  assignedToName: string | null
  assignedById: string | null
  assignedByName: string | null
  isResolved: boolean
  resolvedById: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  editedAt: string | null
  createdAt: string
  replyCount: number
  reactions: { employeeId: string; reaction: string }[]
  mentions: {
    employeeId?: string | null
    name?: string | null
    taskId?: string | null
    taskCode?: string | null
    taskName?: string | null
  }[]
  rowVersion: string
}

export interface MentionInDto {
  employeeId?: number | string
  taskId?: number | string
}

export interface AttachmentDto {
  id: string
  taskId: string
  fileId: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedByUserId: string | null
  uploadedByName: string | null
  createdAt: string
  url: string
}

export interface TimeEntryDto {
  id: string
  taskId: string
  employeeId: string
  employeeName: string
  startAt: string
  endAt: string | null
  minutes: number | null
  isRunning: boolean
  notes: string | null
  rowVersion: string
}

export interface ReminderDto {
  id: string
  workspaceId: string
  entityType: string
  entityId: string
  entityName: string | null
  name: string
  ownerId: string
  ownerName: string
  assigneeId: string | null
  assigneeName: string | null
  remindAt: string
  notifyBeforeMinutes: number | null
  reminderKind: string | null
  notifiedAt: string | null
  createdAt: string
  rowVersion: string
}

export interface ShareDto {
  id: string | null
  entityType: string
  entityId: string
  shareScope: string
  token: string | null
  link: string | null
  isPublic: boolean
  allowOpenTasks: boolean
  validFrom: string | null
  validTo: string | null
  maxAccess: number | null
  accessCount: number
  properties: string[]
  members: {
    id: string
    employeeId: string | null
    employeeName: string | null
    email: string | null
    accessLevel: string
  }[]
  rowVersion: string | null
}
