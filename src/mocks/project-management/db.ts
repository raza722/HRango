import type {
  CommentDto,
  CustomFieldDto,
  FeatureDto,
  FolderDto,
  ListDto,
  RecurrenceDto,
  ReminderDto,
  ShareDto,
  StatusDto,
  TagDto,
  ViewDto,
} from '@/features/project-management/api/pm.dto'
import type { FileRef } from '@/lib/files'

import { createMockCollection } from '../collection'
import {
  seedAttachments,
  seedColumnPermissions,
  seedComments,
  seedCustomFields,
  seedDependencies,
  seedFavorites,
  seedFolders,
  seedLists,
  seedTags,
  seedTasks,
  seedTimeEntries,
  seedViews,
  seedWorkspaces,
} from './seed'

/**
 * The mock of `/api/projects`: records as the backend keeps them (`pm` schema), handed out in the
 * API's shapes by the handlers. Ids are readable strings (`ws_uxui`, `tk_quali`); the frontend
 * sends ids as they are, so the mock accepts numbers and strings alike.
 */

export interface WorkspaceRecord {
  id: string
  name: string
  description: string | null
  privacy: 'private' | 'workspace' | 'public'
  departmentId: string
  ownerId: string
  workflowTemplate: string
  statusMode: 'default' | 'custom'
  statusTemplate: string | null
  statuses: StatusDto[]
  features: FeatureDto[]
  members: { employeeId: string; memberRole: string }[]
  cover: FileRef | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export type ViewRecord = ViewDto & { workspaceId: string }
export type FolderRecord = FolderDto & { workspaceId: string }
export type ListRecord = Omit<ListDto, 'taskCount' | 'closedCount' | 'progressPercent'> & {
  workspaceId: string
}

export interface ColumnPermissionRecord {
  id: string
  workspaceId: string
  columnKey: string
  defaultLevel: string
  roles: { memberRole: string; permissionLevel: string }[]
  members: { employeeId: string; permissionLevel: string }[]
}

export type CustomFieldRecord = CustomFieldDto
export type TagRecord = Omit<TagDto, 'taskCount'>

export interface TaskRecord {
  id: string
  workspaceId: string
  taskListId: string | null
  parentTaskId: string | null
  code: string
  name: string
  description: string | null
  taskType: 'task' | 'milestone'
  statusId: string
  priority: string | null
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  timeEstimateMinutes: number | null
  rating: number | null
  url: string | null
  recurrence: RecurrenceDto | null
  closedAt: string | null
  sortOrder: number
  createdByUserId: string
  createdByName: string
  createdAt: string
  updatedAt: string | null
  assignees: { employeeId: string; storyPoints: number | null }[]
  tagIds: string[]
  fieldValues: { customFieldId: string; fieldValue: string | null }[]
  cover: FileRef | null
  rowVersion: string
}

/** Stored once, as "task waits on other task" (`kind` waiting_on) or a plain link. */
export interface DependencyRecord {
  id: string
  taskId: string
  otherTaskId: string
  kind: 'waiting_on' | 'linked'
}

export type CommentRecord = Omit<
  CommentDto,
  'authorName' | 'assignedToName' | 'assignedByName' | 'resolvedByName' | 'replyCount'
>

export interface AttachmentRecord {
  id: string
  taskId: string
  fileId: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedByName: string | null
  createdAt: string
  url: string
}

export interface TimeEntryRecord {
  id: string
  taskId: string
  employeeId: string
  startAt: string
  endAt: string | null
  minutes: number | null
  isRunning: boolean
  notes: string | null
  rowVersion: string
}

export type ReminderRecord = ReminderDto
export type ShareRecord = Omit<ShareDto, 'id'> & { id: string }

export interface FavoriteRecord {
  id: string
  entityType: 'workspace' | 'folder' | 'task_list' | 'task'
  entityId: string
  kind: 'favorite' | 'hidden'
  createdAt: string
}

const key = (name: string) => `hrms-mock-pm-v2-${name}`

export const workspaces = createMockCollection<WorkspaceRecord>({
  storageKey: key('workspaces'),
  seed: seedWorkspaces,
})
export const views = createMockCollection<ViewRecord>({ storageKey: key('views'), seed: seedViews })
export const folders = createMockCollection<FolderRecord>({
  storageKey: key('folders'),
  seed: seedFolders,
})
export const lists = createMockCollection<ListRecord>({ storageKey: key('lists'), seed: seedLists })
export const columnPermissions = createMockCollection<ColumnPermissionRecord>({
  storageKey: key('column-permissions'),
  seed: seedColumnPermissions,
})
export const customFields = createMockCollection<CustomFieldRecord>({
  storageKey: key('custom-fields'),
  seed: seedCustomFields,
})
export const tags = createMockCollection<TagRecord>({ storageKey: key('tags'), seed: seedTags })
export const tasks = createMockCollection<TaskRecord>({ storageKey: key('tasks'), seed: seedTasks })
export const dependencies = createMockCollection<DependencyRecord>({
  storageKey: key('dependencies'),
  seed: seedDependencies,
})
export const comments = createMockCollection<CommentRecord>({
  storageKey: key('comments'),
  seed: seedComments,
})
export const attachments = createMockCollection<AttachmentRecord>({
  storageKey: key('attachments'),
  seed: seedAttachments,
})
export const timeEntries = createMockCollection<TimeEntryRecord>({
  storageKey: key('time-entries'),
  seed: seedTimeEntries,
})
export const reminders = createMockCollection<ReminderRecord>({
  storageKey: key('reminders'),
  seed: () => [],
})
export const shares = createMockCollection<ShareRecord>({
  storageKey: key('shares'),
  seed: () => [],
})
export const favorites = createMockCollection<FavoriteRecord>({
  storageKey: key('favorites'),
  seed: seedFavorites,
})

export function resetProjectManagementDb(): void {
  for (const collection of [
    workspaces,
    views,
    folders,
    lists,
    columnPermissions,
    customFields,
    tags,
    tasks,
    dependencies,
    comments,
    attachments,
    timeEntries,
    reminders,
    shares,
    favorites,
  ]) {
    collection.reset()
  }
}
