import { format, parseISO } from 'date-fns'

import { DEFAULT_VISIBLE_COLUMNS, PM_SWATCHES } from '../constants'
import {
  type ActivityEntry,
  type Attachment,
  type ColumnPermission,
  EXTENSION_STATUSES,
  type ExtensionRequest,
  type ListColumn,
  type OrganizerFeature,
  type PermissionLevel,
  type PmPerson,
  type PmRole,
  type PmTemplates,
  type Priority,
  type Recurrence,
  type Reminder,
  type ReminderEntry,
  type ShareAccess,
  type ShareEntity,
  type ShareSettings,
  type StatusGroup,
  type StatusTemplate,
  type Tag,
  TASK_COLUMN_KEYS,
  type TaskColumnKey,
  type TaskComment,
  type TaskDetail,
  type TaskRow,
  type TaskStatus,
  type TimeEntry,
  VIEW_KINDS,
  type ViewKind,
  type Visibility,
  type WorkflowTemplate,
  type Workspace,
  type WorkspaceItem,
  type WorkspaceMember,
  type WorkspaceSetup,
  type WorkspaceSummary,
  type WorkspaceView,
} from '../types/pm.types'
import type {
  ActivityDto,
  ApiFeatureCode,
  ApiPermissionLevel,
  ApiStatusGroup,
  ApiViewType,
  ApiWorkspaceRole,
  AttachmentDto,
  ColumnPermissionDto,
  ColumnPermissionInDto,
  ColumnPermissionsDto,
  CommentDto,
  CustomFieldDto,
  ExtensionDto,
  PersonDto,
  RecurrenceDto,
  ReminderDto,
  ShareDto,
  StatusDto,
  TagDto,
  TaskDto,
  TaskRowDto,
  TemplateDto,
  TimeEntryDto,
  WorkspaceDto,
  WorkspaceSummaryDto,
} from './pm.dto'

// --- ids, instants, times --------------------------------------------------------------------------

/**
 * An id as a request body sends it: the API's ids are numbers on the way in (strings on the way
 * out). Non-numeric ids (the mock's readable ones) go as they are.
 */
export const toApiId = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)

/** The API writes UTC instants without an offset; read them as UTC. */
export function instant(value: string): string
export function instant(value: string | null | undefined): string | null
export function instant(value: string | null | undefined): string | null {
  if (!value) return null
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
}

/** `09:30:00` → `09:30`. */
export const toClock = (value: string | null): string | null => (value ? value.slice(0, 5) : null)

// --- enums -----------------------------------------------------------------------------------------

export const statusGroupFromApi = (group: string): StatusGroup =>
  group === 'not_started' ? 'not-started' : (group as StatusGroup)

export const statusGroupToApi = (group: StatusGroup): ApiStatusGroup =>
  group === 'not-started' ? 'not_started' : group

const ROLE_FROM_API: Record<ApiWorkspaceRole, PmRole> = {
  workspace_admin: 'workspace-admin',
  hr: 'hr',
  manager: 'managers',
  team_leader: 'team-leaders',
  contributor: 'contributors',
}
const ROLE_TO_API = Object.fromEntries(
  Object.entries(ROLE_FROM_API).map(([api, role]) => [role, api]),
) as Record<PmRole, ApiWorkspaceRole>

export const roleFromApi = (role: string | null): PmRole | null =>
  role && role in ROLE_FROM_API ? ROLE_FROM_API[role as ApiWorkspaceRole] : null
export const roleToApi = (role: PmRole): ApiWorkspaceRole => ROLE_TO_API[role]

/** Rank of a workspace role (admin 5 … contributor 1; a reader who is not a member 0). */
export const ROLE_RANK: Record<PmRole, number> = {
  'workspace-admin': 5,
  hr: 4,
  managers: 3,
  'team-leaders': 2,
  contributors: 1,
}
export const rankOf = (role: PmRole | null): number => (role ? ROLE_RANK[role] : 0)

export const levelFromApi = (level: string): PermissionLevel =>
  level === 'can_edit' ? 'can-edit' : level === 'can_view' ? 'can-view' : (level as PermissionLevel)
export const levelToApi = (level: PermissionLevel): ApiPermissionLevel =>
  level === 'can-edit' ? 'can_edit' : level === 'can-view' ? 'can_view' : level

export const viewFromApi = (type: string): ViewKind | null => {
  const kind = type === 'mind_map' ? 'mind-map' : type
  return (VIEW_KINDS as readonly string[]).includes(kind) ? (kind as ViewKind) : null
}
export const viewToApi = (kind: ViewKind): ApiViewType => (kind === 'mind-map' ? 'mind_map' : kind)

const FEATURE_TO_API: Record<OrganizerFeature, ApiFeatureCode> = {
  priority: 'priority',
  'add-fields': 'custom_fields',
  'remap-subtask-due-dates': 'remap_subtask_due_dates',
  'multiple-assignees': 'multiple_assignees',
  'story-points': 'story_points',
  tags: 'tags',
  'time-estimate': 'time_estimate',
  'time-tracking': 'time_tracking',
  'incomplete-warnings': 'incomplete_warning',
  'dependencies-warnings': 'dependency_warning',
  'reschedule-dependencies': 'reschedule_dependencies',
  'show-status-progress': 'show_status_progress',
  email: 'email',
  'sprint-points': 'sprints',
  'wip-limits': 'wip_limits',
}
const FEATURE_FROM_API = Object.fromEntries(
  Object.entries(FEATURE_TO_API).map(([feature, api]) => [api, feature]),
) as Record<ApiFeatureCode, OrganizerFeature>

export const featureToApi = (feature: OrganizerFeature): ApiFeatureCode => FEATURE_TO_API[feature]
export const featureFromApi = (code: string): OrganizerFeature | null =>
  code in FEATURE_FROM_API ? FEATURE_FROM_API[code as ApiFeatureCode] : null

/** List view column keys as the API names them (permissions, view config). Labels is a custom field. */
const COLUMN_TO_API: Record<Exclude<TaskColumnKey, 'labels'>, string> = {
  name: 'name',
  assignees: 'assignees',
  startDate: 'start_date',
  dueDate: 'due_date',
  priority: 'priority',
  tags: 'tags',
  dependencies: 'dependencies',
  status: 'status',
  progress: 'progress',
  timeEstimate: 'time_estimate',
  timeTracked: 'time_tracked',
  taskId: 'task_id',
  createdBy: 'created_by',
  dateCreated: 'date_created',
  dateClosed: 'date_closed',
  latestComment: 'latest_comment',
  storyPoints: 'story_points',
  files: 'files',
}

/** The API key of a column; null for Labels while the workspace has no Labels field. */
export function columnToApi(key: TaskColumnKey, labelsFieldId: string | null): string | null {
  if (key === 'labels') return labelsFieldId ? `cf_${labelsFieldId}` : null
  return COLUMN_TO_API[key]
}

export function columnFromApi(key: string, labelsFieldId: string | null): TaskColumnKey | null {
  if (labelsFieldId && key === `cf_${labelsFieldId}`) return 'labels'
  if (key === 'labels') return 'labels'
  const found = Object.entries(COLUMN_TO_API).find(([, api]) => api === key)
  return found ? (found[0] as TaskColumnKey) : null
}

// --- people, templates -------------------------------------------------------------------------------

export const personFromApi = (dto: PersonDto): PmPerson => ({
  id: dto.id,
  name: dto.name,
  designation: dto.designationName ?? '',
  department: dto.departmentName ?? '',
  photoUrl: dto.photoUrl,
})

let templateStatusSequence = 0
const templateStatus = (
  status: TemplateDto['statuses'][number],
  code: string,
  index: number,
): TaskStatus => {
  templateStatusSequence += 1
  return {
    id: `tpl_${code}_${index}_${templateStatusSequence}`,
    name: status.name,
    color: status.color ?? '#979797',
    group: statusGroupFromApi(status.statusGroup),
  }
}

/** Workflow templates (Define Workflow cards) and status templates from `GET /templates`. */
export function templatesFromApi(workflows: TemplateDto[], statuses: TemplateDto[]): PmTemplates {
  const workflowList = workflows.map((dto): WorkflowTemplate => {
    const views = dto.views
      .map((view) => viewFromApi(view.viewType))
      .filter((view): view is ViewKind => view !== null)
    const defaultView =
      viewFromApi(dto.views.find((view) => view.isDefault)?.viewType ?? 'list') ?? 'list'
    const setup: WorkspaceSetup = {
      views: views.includes('list') ? views : ['list', ...views],
      defaultView,
      statusMode: 'default',
      statusTemplate: null,
      statuses: dto.statuses.map((status, index) => templateStatus(status, dto.code, index)),
      organizer: dto.features
        .map((feature) => featureFromApi(feature.featureCode))
        .filter((feature): feature is OrganizerFeature => feature !== null),
    }
    return { id: dto.code, name: dto.name, description: dto.description ?? '', setup }
  })
  const statusList = statuses.map((dto): StatusTemplate => ({
    id: dto.code,
    name: dto.name,
    description: dto.description ?? '',
    statuses: dto.statuses.map((status, index) => templateStatus(status, dto.code, index)),
  }))
  return { workflows: workflowList, statusTemplates: statusList }
}

// --- workspaces ---------------------------------------------------------------------------------------

const visibilityFromApi = (privacy: string): Visibility =>
  privacy === 'private' || privacy === 'public' ? privacy : 'workspace'

export const workspaceSummaryFromApi = (dto: WorkspaceSummaryDto): WorkspaceSummary => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? '',
  visibility: visibilityFromApi(dto.privacy),
  departmentId: dto.departmentId,
  departmentName: dto.departmentName,
  ownerId: dto.ownerId,
  ownerName: dto.ownerName,
  myRole: roleFromApi(dto.myRole),
  favorite: dto.isFavorite,
  hidden: dto.isHidden,
  memberCount: dto.memberCount,
  cover: dto.cover ?? null,
  createdAt: instant(dto.createdAt),
  rowVersion: dto.rowVersion,
})

const statusFromApi = (dto: StatusDto): TaskStatus => ({
  id: dto.id,
  name: dto.name,
  color: dto.color ?? '#979797',
  group: statusGroupFromApi(dto.statusGroup),
})

const memberFromApi = (dto: WorkspaceDto['members'][number]): WorkspaceMember => ({
  employeeId: dto.employeeId,
  name: dto.name,
  designation: dto.designationName ?? '',
  department: dto.departmentName ?? '',
  role: roleFromApi(dto.memberRole) ?? 'contributors',
})

const viewOf = (dto: WorkspaceDto['views'][number]): WorkspaceView | null => {
  const kind = viewFromApi(dto.viewType)
  if (!kind) return null
  return {
    id: dto.id,
    kind,
    name: dto.name,
    listId: dto.taskListId,
    isDefault: dto.isDefault,
    isRequired: dto.isRequired,
    isPrivate: dto.isPrivate,
    ownerId: dto.ownerId,
    config: dto.config,
    rowVersion: dto.rowVersion,
  }
}

const EMPTY_PERMISSION: ColumnPermission = { defaultLevel: 'default', roles: {}, members: [] }

function permissionFromApi(dto: ColumnPermissionDto | undefined): ColumnPermission {
  if (!dto) return structuredClone(EMPTY_PERMISSION)
  const roles: ColumnPermission['roles'] = {}
  for (const entry of dto.roles) {
    const role = roleFromApi(entry.memberRole)
    if (role) roles[role] = levelFromApi(entry.permissionLevel)
  }
  return {
    defaultLevel: levelFromApi(dto.defaultLevel),
    roles,
    members: dto.members.map((entry) => ({
      employeeId: entry.employeeId,
      level: levelFromApi(entry.permissionLevel),
    })),
  }
}

export function permissionToApi(permission: ColumnPermission): ColumnPermissionInDto {
  return {
    defaultLevel: levelToApi(permission.defaultLevel),
    roles: Object.entries(permission.roles)
      .filter(([, level]) => level !== 'default')
      .map(([role, level]) => ({
        memberRole: roleToApi(role as PmRole),
        permissionLevel: levelToApi(level),
      })),
    members: permission.members
      .filter((entry) => entry.level !== 'default')
      .map((entry) => ({
        employeeId: toApiId(entry.employeeId),
        permissionLevel: levelToApi(entry.level),
      })),
  }
}

/**
 * The List view whose config holds the columns: the caller's own private one (the API lists only
 * the caller's private views), else the workspace's.
 */
export function columnsView(views: readonly WorkspaceView[]): WorkspaceView | undefined {
  const lists = views.filter((view) => view.kind === 'list' && view.listId === null)
  return (
    lists.find((view) => view.isPrivate) ??
    lists.find((view) => !view.isPrivate && view.isDefault) ??
    lists.find((view) => !view.isPrivate)
  )
}

interface ConfigColumn {
  key: string
  visible: boolean
}

const isConfigColumn = (value: unknown): value is ConfigColumn =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ConfigColumn).key === 'string' &&
  typeof (value as ConfigColumn).visible === 'boolean'

/** Columns in the view's order (`config.columns`), or the design's first five when not set. */
function columnsFromConfig(
  config: Record<string, unknown> | null | undefined,
  labelsFieldId: string | null,
): { key: TaskColumnKey; visible: boolean }[] {
  const saved = Array.isArray(config?.columns) ? config.columns.filter(isConfigColumn) : null
  if (!saved) {
    return TASK_COLUMN_KEYS.map((key) => ({ key, visible: DEFAULT_VISIBLE_COLUMNS.includes(key) }))
  }
  const out: { key: TaskColumnKey; visible: boolean }[] = []
  for (const entry of saved) {
    const key = columnFromApi(entry.key, labelsFieldId)
    if (key && !out.some((column) => column.key === key)) out.push({ key, visible: entry.visible })
  }
  if (!out.some((column) => column.key === 'name')) out.unshift({ key: 'name', visible: true })
  return out
}

/** The `config.columns` a view saves for these columns. */
export function columnsToConfig(
  columns: readonly ListColumn[],
  labelsFieldId: string | null,
): { columns: ConfigColumn[] } {
  return {
    columns: columns.map((column) => ({
      key: columnToApi(column.key, labelsFieldId) ?? column.key,
      visible: column.visible,
    })),
  }
}

export function workspaceFromApi(
  dto: WorkspaceDto,
  permissions: ColumnPermissionsDto,
  fields: readonly CustomFieldDto[],
): Workspace {
  const labelsFieldId = fields.find((field) => field.fieldType === 'labels')?.id ?? null
  const views = dto.views.map(viewOf).filter((view): view is WorkspaceView => view !== null)
  const shared = views.filter((view) => !view.isPrivate && view.listId === null)
  const kinds = [...new Set(shared.map((view) => view.kind))]
  const members = dto.members.map(memberFromApi)
  const byKey = new Map(
    permissions.columns.map((entry) => [columnFromApi(entry.columnKey, labelsFieldId), entry]),
  )
  const columns: ListColumn[] = columnsFromConfig(columnsView(views)?.config, labelsFieldId).map(
    (column) => ({ ...column, permission: permissionFromApi(byKey.get(column.key)) }),
  )
  const myLevels: Workspace['myLevels'] = {}
  for (const [key, level] of Object.entries(permissions.myLevels)) {
    const column = columnFromApi(key, labelsFieldId)
    if (column) myLevels[column] = levelFromApi(level)
  }
  const items: WorkspaceItem[] = [
    ...dto.folders.map((folder): WorkspaceItem => ({
      id: `folder:${folder.id}`,
      workspaceId: dto.id,
      parentId: null,
      kind: 'folder',
      name: folder.name,
      order: folder.sortOrder ?? 0,
      rowVersion: folder.rowVersion,
    })),
    ...dto.lists.map((list): WorkspaceItem => ({
      id: list.id,
      workspaceId: dto.id,
      parentId: list.folderId ? `folder:${list.folderId}` : null,
      kind: 'list',
      name: list.name,
      order: list.sortOrder ?? 0,
      rowVersion: list.rowVersion,
    })),
  ].toSorted((a, b) => a.order - b.order)

  return {
    ...workspaceSummaryFromApi(dto),
    template: dto.workflowTemplate,
    templateName: dto.workflowTemplateName,
    setup: {
      views: kinds.includes('list') ? kinds : ['list', ...kinds],
      defaultView: shared.find((view) => view.isDefault)?.kind ?? 'list',
      statusMode: dto.statusMode === 'custom' ? 'custom' : 'default',
      statusTemplate: dto.statusTemplate,
      statuses: dto.statuses
        .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(statusFromApi),
      organizer: dto.features
        .map((feature) => featureFromApi(feature.featureCode))
        .filter((feature): feature is OrganizerFeature => feature !== null),
    },
    members,
    memberIds: [
      dto.ownerId,
      ...members.map((member) => member.employeeId).filter((id) => id !== dto.ownerId),
    ],
    views,
    items,
    columns,
    myLevels,
    labelsFieldId,
  }
}

/** A folder item's API id (`folder:12` → `12`). */
export const folderApiId = (itemId: string): string => itemId.replace(/^folder:/, '')

// --- tags and labels ----------------------------------------------------------------------------------

const swatch = (index: number) => PM_SWATCHES[index % PM_SWATCHES.length] ?? '#7127EA'

export const tagFromApi = (dto: TagDto, index: number): Tag => ({
  id: dto.id,
  workspaceId: dto.workspaceId,
  kind: 'tag',
  name: dto.name,
  color: dto.color ?? swatch(index),
  rowVersion: dto.rowVersion,
})

/** A label's id: its field and option name. */
export const labelId = (fieldId: string, option: string) => `${fieldId}:${option}`
export const labelParts = (id: string): { fieldId: string; option: string } => {
  const at = id.indexOf(':')
  return { fieldId: id.slice(0, at), option: id.slice(at + 1) }
}

export const labelOptions = (field: CustomFieldDto): string[] =>
  Array.isArray(field.config?.options)
    ? field.config.options.filter((option): option is string => typeof option === 'string')
    : []

/** The options of the workspace's Labels field, as label "tags" (colours from the palette). */
export function labelsFromField(field: CustomFieldDto | undefined): Tag[] {
  if (!field) return []
  return labelOptions(field).map((option, index) => ({
    id: labelId(field.id, option),
    workspaceId: field.workspaceId,
    kind: 'label',
    name: option,
    color: swatch(index + 3),
    rowVersion: field.rowVersion,
  }))
}

// --- tasks ------------------------------------------------------------------------------------------------

export function recurrenceFromApi(dto: RecurrenceDto | null): Recurrence | null {
  if (!dto) return null
  return {
    every: dto.every,
    unit: dto.unit,
    weekdays: dto.weekdays,
    ends:
      dto.ends === 'on' && dto.endDate
        ? { kind: 'on', date: dto.endDate }
        : dto.ends === 'after' && dto.count
          ? { kind: 'after', count: dto.count }
          : { kind: 'never' },
  }
}

export function recurrenceToApi(recurrence: Recurrence | null): RecurrenceDto | null {
  if (!recurrence) return null
  return {
    every: recurrence.every,
    unit: recurrence.unit,
    weekdays: recurrence.weekdays,
    ends: recurrence.ends.kind,
    endDate: recurrence.ends.kind === 'on' ? recurrence.ends.date : null,
    count: recurrence.ends.kind === 'after' ? recurrence.ends.count : null,
  }
}

/** Label ids of a row: every list-valued custom field value, read as option names. */
function labelIdsOf(values: TaskRowDto['fieldValues']): string[] {
  const out: string[] = []
  for (const value of values) {
    if (!value.fieldValue?.startsWith('[')) continue
    try {
      const parsed: unknown = JSON.parse(value.fieldValue)
      if (Array.isArray(parsed)) {
        for (const option of parsed) {
          if (typeof option === 'string') out.push(labelId(value.customFieldId, option))
        }
      }
    } catch {
      // Not a list value.
    }
  }
  return out
}

const PRIORITY_VALUES: readonly string[] = ['urgent', 'high', 'normal', 'low']

export function taskRowFromApi(dto: TaskRowDto, favorites?: ReadonlySet<string>): TaskRow {
  return {
    id: dto.id,
    code: dto.code ?? '',
    workspaceId: dto.workspaceId,
    listId: dto.taskListId,
    listName: dto.listName,
    parentId: dto.parentTaskId,
    name: dto.name,
    description: dto.description ?? '',
    statusId: dto.statusId,
    type: dto.taskType === 'milestone' ? 'milestone' : 'task',
    assigneeIds: dto.assignees.map((entry) => entry.employeeId),
    assignees: dto.assignees.map((entry) => ({
      employeeId: entry.employeeId,
      name: entry.name,
      storyPoints: entry.storyPoints ?? null,
    })),
    startDate: dto.startDate,
    startTime: toClock(dto.startTime),
    dueDate: dto.dueDate,
    dueTime: toClock(dto.dueTime),
    isOverdue: dto.isOverdue === true,
    recurrence: recurrenceFromApi(dto.recurrence),
    priority:
      dto.priority && PRIORITY_VALUES.includes(dto.priority) ? (dto.priority as Priority) : null,
    tagIds: dto.tags.map((tag) => tag.id),
    labelIds: labelIdsOf(dto.fieldValues),
    storyPoints: dto.assignees
      .filter((entry) => entry.storyPoints !== null)
      .map((entry) => ({ employeeId: entry.employeeId, points: entry.storyPoints ?? 0 })),
    rating: dto.rating ?? 0,
    timeEstimateMinutes: dto.timeEstimateMinutes,
    timeTrackedMinutes: dto.timeTrackedMinutes ?? 0,
    attachmentCount: dto.attachmentCount ?? 0,
    openDependencyCount: dto.openDependencyCount ?? 0,
    blockingCount: dto.blockingCount ?? 0,
    favorite: favorites?.has(dto.id) ?? false,
    createdByName: dto.createdByName,
    createdAt: instant(dto.createdAt) ?? '',
    closedAt: instant(dto.closedAt),
    originalDueDate: dto.originalDueDate,
    isClosedLate: dto.isClosedLate,
    order: dto.sortOrder ?? 0,
    cover: dto.cover ?? null,
    rowVersion: dto.rowVersion,
    subtaskCount: dto.subtaskCount,
    commentCount: dto.commentCount,
    latestComment: dto.latestComment
      ? {
          authorName: dto.latestComment.authorName,
          body: dto.latestComment.body,
          createdAt: instant(dto.latestComment.createdAt),
        }
      : null,
  }
}

export function taskDetailFromApi(dto: TaskDto): TaskDetail {
  const row = taskRowFromApi(dto)
  const dependencies = dto.dependencies.map((entry) => ({
    id: entry.id,
    kind:
      entry.kind === 'blocking'
        ? ('blocking' as const)
        : entry.kind === 'linked'
          ? ('linked' as const)
          : ('waiting_on' as const),
    taskId: entry.taskId,
    code: entry.code,
    name: entry.name,
    statusName: entry.statusName,
    statusColor: entry.statusColor,
  }))
  return {
    ...row,
    favorite: dto.isFavorite,
    myRole: roleFromApi(dto.myRole),
    dependencies,
    waitingOn: dependencies
      .filter((entry) => entry.kind === 'waiting_on')
      .map((entry) => entry.taskId),
    blocking: dependencies
      .filter((entry) => entry.kind === 'blocking')
      .map((entry) => entry.taskId),
    hiddenColumns: dto.hiddenColumns,
    extensions: dto.extensions
      .map(extensionFromApi)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

export const extensionFromApi = (dto: ExtensionDto): ExtensionRequest => ({
  id: dto.id,
  requestedById: dto.requestedById,
  requestedByName: dto.requestedByName,
  oldDueDate: dto.oldDueDate,
  newDueDate: dto.newDueDate,
  reason: dto.reason,
  status: EXTENSION_STATUSES.find((status) => status === dto.status) ?? 'pending',
  decidedByName: dto.decidedByName,
  decidedAt: instant(dto.decidedAt),
  remarks: dto.remarks,
  createdAt: instant(dto.createdAt),
  rowVersion: dto.rowVersion,
})

// --- collaboration -------------------------------------------------------------------------------------

export const commentFromApi = (dto: CommentDto): TaskComment => ({
  id: dto.id,
  taskId: dto.taskId,
  parentId: dto.parentId,
  authorId: dto.authorId,
  authorName: dto.authorName,
  body: dto.body,
  createdAt: instant(dto.createdAt),
  editedAt: instant(dto.editedAt),
  assignedToId: dto.assignedToId,
  assignedToName: dto.assignedToName,
  assignedById: dto.assignedById,
  assignedByName: dto.assignedByName,
  resolved: dto.isResolved,
  resolvedById: dto.resolvedById,
  resolvedByName: dto.resolvedByName,
  likedByIds: dto.reactions
    .filter((reaction) => reaction.reaction === 'like')
    .map((reaction) => reaction.employeeId),
  reactions: dto.reactions.filter((reaction) => reaction.reaction !== 'like'),
  rowVersion: dto.rowVersion,
})

export const attachmentFromApi = (dto: AttachmentDto): Attachment => ({
  id: dto.id,
  fileId: dto.fileId,
  name: dto.name,
  mimeType: dto.mimeType,
  size: dto.sizeBytes ?? 0,
  uploadedByName: dto.uploadedByName,
  uploadedAt: instant(dto.createdAt),
  url: dto.url,
})

export function timeEntryFromApi(dto: TimeEntryDto): TimeEntry {
  const start = parseISO(instant(dto.startAt))
  const end = dto.endAt ? parseISO(instant(dto.endAt)) : null
  const minutes =
    dto.minutes ?? (end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000)) : 0)
  return {
    id: dto.id,
    employeeId: dto.employeeId,
    employeeName: dto.employeeName,
    date: format(start, 'yyyy-MM-dd'),
    start: format(start, 'HH:mm'),
    end: end ? format(end, 'HH:mm') : null,
    minutes,
    notes: dto.notes ?? '',
    isRunning: dto.isRunning,
    startAt: instant(dto.startAt),
    rowVersion: dto.rowVersion,
  }
}

export const reminderFromApi = (dto: ReminderDto): Reminder => ({
  id: dto.id,
  remindAt: instant(dto.remindAt),
  rowVersion: dto.rowVersion,
})

export const activityFromApi = (dto: ActivityDto): ActivityEntry => ({
  id: dto.id,
  entityType: dto.entityType,
  entityId: dto.entityId,
  itemCode: dto.itemCode,
  itemName: dto.itemName,
  action: dto.actionName,
  fieldName: dto.fieldName,
  oldValue: dto.oldValue,
  newValue: dto.newValue,
  performedByName: dto.performedByName,
  performedAt: instant(dto.performedAt),
})

export const reminderEntryFromApi = (dto: ReminderDto): ReminderEntry => ({
  ...reminderFromApi(dto),
  workspaceId: dto.workspaceId,
  entityType: dto.entityType,
  entityId: dto.entityId,
  entityName: dto.entityName,
  name: dto.name,
  notifyBeforeMinutes: dto.notifyBeforeMinutes,
  notifiedAt: instant(dto.notifiedAt),
})

/** `2026-10-26T10:00:00Z` → `2026-10-26T15:00` (local, for datetime-local inputs). */
const toLocalInput = (value: string | null) =>
  value ? format(parseISO(instant(value)), "yyyy-MM-dd'T'HH:mm") : null

export function shareFromApi(dto: ShareDto): ShareSettings {
  const people: ShareSettings['people'] = []
  const invitedEmails: string[] = []
  for (const member of dto.members) {
    if (member.employeeId) {
      people.push({ employeeId: member.employeeId, access: member.accessLevel as ShareAccess })
    } else if (member.email) {
      invitedEmails.push(member.email)
    }
  }
  return {
    id: dto.id,
    entityType: dto.entityType as ShareEntity,
    entityId: dto.entityId,
    scope: dto.shareScope === 'page' ? 'page' : 'list',
    people,
    invitedEmails,
    linkEnabled: dto.isPublic,
    link: dto.link,
    validFrom: toLocalInput(dto.validFrom),
    validTo: toLocalInput(dto.validTo),
    maxAccess: dto.maxAccess,
    allowOpeningTasks: dto.allowOpenTasks,
    properties: dto.properties,
    rowVersion: dto.rowVersion,
  }
}

export function shareToApi(settings: ShareSettings) {
  const iso = (value: string | null) => (value ? new Date(value).toISOString() : null)
  return {
    entityType: settings.entityType,
    entityId: toApiId(settings.entityId),
    shareScope: settings.scope,
    isPublic: settings.linkEnabled,
    allowOpenTasks: settings.allowOpeningTasks,
    validFrom: settings.linkEnabled ? iso(settings.validFrom) : null,
    validTo: settings.linkEnabled ? iso(settings.validTo) : null,
    maxAccess: settings.linkEnabled ? settings.maxAccess : null,
    properties: settings.properties,
    members: [
      ...settings.people.map((entry) => ({
        employeeId: toApiId(entry.employeeId),
        accessLevel: entry.access,
      })),
      ...settings.invitedEmails.map((email) => ({ email, accessLevel: 'limited' as const })),
    ],
    rowVersion: settings.rowVersion,
  }
}
