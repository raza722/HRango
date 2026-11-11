import type {
  OrganizerFeature,
  PermissionLevel,
  PmRole,
  Priority,
  StatusGroup,
  TaskColumnKey,
  ViewKind,
  Visibility,
} from './types/pm.types'

export const WORKSPACE_NAME_MAX = 50
export const WORKSPACE_DESCRIPTION_MAX = 300

/**
 * Who can see a workspace (the API's `privacy`), as the wizard and Workspace Settings offer it.
 * The titles and texts say plainly how the three differ; the backend today treats "workspace"
 * and "public" alike (any employee can read, only members change things): see
 * docs/backend-handoff/project-management-2026-11-11.md, B1.
 */
export const VISIBILITY_OPTIONS: readonly { value: Visibility; title: string; text: string }[] = [
  {
    value: 'private',
    title: 'Private',
    text: 'Only the owner and the members you invite can see this workspace.',
  },
  {
    value: 'public',
    title: 'Everyone can view',
    text: 'Everyone in the company can open this workspace and read its tasks. Only its members can make changes.',
  },
  {
    value: 'workspace',
    title: 'Everyone can work in it',
    text: 'Everyone in the company can open this workspace and work on its tasks, like a member.',
  },
]

export const VIEW_LABELS: Record<ViewKind, string> = {
  list: 'List',
  board: 'Board',
  calendar: 'Calendar',
  activity: 'Activity',
  team: 'Team',
  timeline: 'Timeline',
  table: 'Table',
  gantt: 'Gantt',
  workload: 'Workload',
  'mind-map': 'Mind Map',
}

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  'not-started': 'Not Started',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
}

export const ORGANIZER_LABELS: Record<OrganizerFeature, string> = {
  priority: 'Priority',
  'add-fields': 'Add Fields',
  'remap-subtask-due-dates': 'Remap Subtask Due Dates',
  'multiple-assignees': 'Multiple Assignees',
  'story-points': 'Story Points',
  tags: 'Tags',
  'time-estimate': 'Time Estimate',
  'time-tracking': 'Time Tracking',
  'incomplete-warnings': 'Incomplete Warnings',
  'dependencies-warnings': 'Dependencies Warning',
  'reschedule-dependencies': 'Reschedule Dependencies',
  'show-status-progress': 'Show Status Progress',
  email: 'Email',
  'sprint-points': 'Sprint Points',
  'wip-limits': 'Work in-Progress Limits',
}

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#DC3545' },
  high: { label: 'High', color: '#F79009' },
  normal: { label: 'Normal', color: '#2E64E2' },
  low: { label: 'Low', color: '#626262' },
}

export const COLUMN_LABELS: Record<TaskColumnKey, string> = {
  name: 'Task Name',
  assignees: 'Add Assignee',
  startDate: 'Start Date',
  dueDate: 'Due Date',
  priority: 'Set Priority',
  tags: 'Add Tags',
  dependencies: 'Dependencies',
  status: 'Status',
  progress: 'Progress Bar',
  timeEstimate: 'Time Estimate',
  timeTracked: 'Time Tracked',
  taskId: 'Task ID',
  createdBy: 'Created by',
  dateCreated: 'Date Created',
  dateClosed: 'Date Closed',
  latestComment: 'Latest Comment',
  storyPoints: 'Story Points',
  files: 'Files',
  labels: 'Labels',
}

/** Columns a new workspace's List view shows, in order (Workspace Page 1:2755). */
export const DEFAULT_VISIBLE_COLUMNS: readonly TaskColumnKey[] = [
  'name',
  'assignees',
  'startDate',
  'dueDate',
  'priority',
]

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  default: 'Default',
  'can-edit': 'Can Edit',
  'can-view': 'Can View',
  private: 'Private Field',
}

export const ROLE_LABELS: Record<PmRole, string> = {
  'workspace-admin': 'Workspace Admin Creator',
  hr: "HR's",
  managers: 'Managers',
  'team-leaders': 'Team Leaders',
  contributors: 'Contributors',
}

/** Colours offered by "Add Status Color" and the tag / label pickers. */
export const PM_SWATCHES = [
  '#7127EA',
  '#2E64E2',
  '#2CBD4D',
  '#F79009',
  '#E5383B',
  '#87909E',
  '#12B76A',
  '#0BA5EC',
  '#EE46BC',
  '#9E77ED',
  '#F04438',
  '#475467',
] as const
