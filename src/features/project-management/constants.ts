import type {
  OrganizerFeature,
  PermissionLevel,
  PmRole,
  Priority,
  StatusGroup,
  StatusTemplateId,
  TaskColumnKey,
  TaskStatus,
  ViewKind,
  WorkflowTemplateId,
  WorkspaceSetup,
} from './types/pm.types'

export const WORKSPACE_NAME_MAX = 50
export const WORKSPACE_DESCRIPTION_MAX = 300

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

export const STATUS_TEMPLATE_LABELS: Record<StatusTemplateId, string> = {
  custom: 'Custom',
  content: 'Content',
  kanban: 'Kanban',
  marketing: 'Marketing',
  scrum: 'Scrum',
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

// --- statuses ------------------------------------------------------------------------------------

const status = (id: string, name: string, color: string, group: StatusGroup): TaskStatus => ({
  id,
  name,
  color,
  group,
})

/**
 * "Default statuses for workspace" of Work Starter (Edit Default Statuses 651:209727, summary
 * 576:191345): To Do > In-Progress > Completed, in the frames' ring colours.
 */
export const DEFAULT_STATUSES: readonly TaskStatus[] = [
  status('st_todo', 'To Do', '#979797', 'not-started'),
  status('st_progress', 'In-Progress', '#2F639A', 'active'),
  status('st_completed', 'Completed', '#318845', 'closed'),
]

/**
 * Statuses of each status template ("Status Templates" dropdown, 702:206158), as the template
 * pages draw them: Content 916:141537, Kanban 935:192293, Marketing 957:199300, Scrum
 * 965:238253. "Custom" starts from the chosen workflow's own statuses (Custom Statuses 702:210425
 * shows Work Starter's); this entry is Work Starter's set.
 */
export const STATUS_TEMPLATE_STATUSES: Record<StatusTemplateId, readonly TaskStatus[]> = {
  custom: DEFAULT_STATUSES,
  content: [
    status('st_c_open', 'Open', '#979797', 'not-started'),
    status('st_c_ready', 'Content Ready', '#2F669A', 'active'),
    status('st_c_writing', 'Writing', '#562F9A', 'active'),
    status('st_c_approval', 'Content Approval', '#389A2F', 'active'),
    status('st_c_rejected', 'Article Rejected', '#9A2F2F', 'active'),
    status('st_c_published', 'Published Article', '#619A2F', 'active'),
    status('st_c_completed', 'Completed', '#318845', 'closed'),
  ],
  kanban: [
    status('st_k_open', 'Open', '#979797', 'not-started'),
    status('st_k_progress', 'In-Progress', '#2F639A', 'active'),
    status('st_k_review', 'Review', '#562F9A', 'active'),
    status('st_k_pending', 'Pending', '#DC9600', 'active'),
    status('st_k_completed', 'Completed', '#318845', 'closed'),
  ],
  marketing: [
    status('st_m_open', 'Open', '#979797', 'not-started'),
    status('st_m_ads', '3 Ads Active', '#2F639A', 'active'),
    status('st_m_ab', 'A/B Testing', '#562F9A', 'active'),
    status('st_m_running', 'Running', '#4DDC00', 'active'),
    status('st_m_progress', 'In-Progress', '#DC9600', 'active'),
    status('st_m_review', 'Review', '#DC1200', 'active'),
    status('st_m_completed', 'Completed', '#318845', 'closed'),
  ],
  scrum: [
    status('st_s_open', 'Open', '#979797', 'not-started'),
    status('st_s_pending', 'Pending', '#2F639A', 'active'),
    status('st_s_progress', 'In-Progress', '#562F9A', 'active'),
    status('st_s_done', 'Completed', '#4DDC00', 'active'),
    status('st_s_review', 'In-Review', '#DC9600', 'active'),
    status('st_s_accepted', 'Accepted', '#0072DC', 'active'),
    status('st_s_rejected', 'Rejected', '#DC1200', 'active'),
    status('st_s_blocked', 'Blocked', '#DC5C00', 'active'),
    status('st_s_completed', 'Completed', '#318845', 'closed'),
  ],
}

/** Project Management's statuses (summary 605:195114: To Do > Planning > In-Progress > At Risk > Up…). */
const PROJECT_MANAGEMENT_STATUSES: readonly TaskStatus[] = [
  status('st_pm_todo', 'To Do', '#979797', 'not-started'),
  status('st_pm_planning', 'Planning', '#762AFD', 'active'),
  status('st_pm_progress', 'In-Progress', '#2F639A', 'active'),
  status('st_pm_risk', 'At Risk', '#DC3545', 'active'),
  status('st_pm_update', 'Update Required', '#E9540D', 'active'),
  status('st_pm_completed', 'Completed', '#318845', 'closed'),
]

/**
 * Marketing Team's statuses (summary 610:194677 for the first four and their colours; Custom
 * Statuses 1087:486644 for the rest).
 */
const MARKETING_TEAM_STATUSES: readonly TaskStatus[] = [
  status('st_mt_backlog', 'Backlog', '#979797', 'not-started'),
  status('st_mt_planning', 'Planning', '#762AFD', 'active'),
  status('st_mt_progress', 'In-Progress', '#2F639A', 'active'),
  status('st_mt_review', 'Ready for Review', '#2E64E2', 'active'),
  status('st_mt_update', 'Update Required', '#B2B22F', 'active'),
  status('st_mt_hold', 'On Hold', '#9A782F', 'active'),
  status('st_mt_completed', 'Completed', '#318845', 'closed'),
]

/** Product & Engineering's statuses (summary 651:206246: Backlog > Planning > In-Progress > Ready for Review…). */
const PRODUCT_ENGINEERING_STATUSES: readonly TaskStatus[] = [
  status('st_pe_backlog', 'Backlog', '#979797', 'not-started'),
  status('st_pe_planning', 'Planning', '#762AFD', 'active'),
  status('st_pe_progress', 'In-Progress', '#2F639A', 'active'),
  status('st_pe_review', 'Ready for Review', '#2E64E2', 'active'),
  status('st_pe_completed', 'Completed', '#318845', 'closed'),
]

// --- workflow templates (Define Workflow cards) -----------------------------------------------

export interface WorkflowTemplate {
  id: WorkflowTemplateId
  name: string
  description: string
  setup: WorkspaceSetup
}

const WORK_STARTER_ORGANIZER: OrganizerFeature[] = [
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
]

const setup = (
  views: ViewKind[],
  statuses: readonly TaskStatus[],
  organizer: OrganizerFeature[],
): WorkspaceSetup => ({
  views,
  defaultView: 'list',
  statusMode: 'default',
  statusTemplate: 'custom',
  statuses: [...statuses],
  organizer,
})

/**
 * The four Define Workflow cards (540:183144). Views and statuses follow each template's Customize
 * summary (576:191345, 605:195114, 610:194677, 651:206246), views in the summary's order; all four
 * summaries list the same organizer features. The card copy is as drawn (Product & Engineering
 * repeats Project Management's description in the design).
 */
export const WORKFLOW_TEMPLATE_LIST: readonly WorkflowTemplate[] = [
  {
    id: 'work-starter',
    name: 'Work Starter',
    description: 'Work Starter to perform for everyday task',
    setup: setup(['list', 'board'], DEFAULT_STATUSES, WORK_STARTER_ORGANIZER),
  },
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Project Management to perform plan, manage, and execute projects',
    setup: setup(
      ['list', 'board', 'calendar', 'gantt', 'team'],
      PROJECT_MANAGEMENT_STATUSES,
      WORK_STARTER_ORGANIZER,
    ),
  },
  {
    id: 'marketing-team',
    name: 'Marketing Team',
    description: 'Marketing Team to perform for run effective campaigns and strategies',
    setup: setup(
      ['list', 'board', 'team', 'calendar'],
      MARKETING_TEAM_STATUSES,
      WORK_STARTER_ORGANIZER,
    ),
  },
  {
    id: 'product-engineering',
    name: 'Product & Engineering',
    description: 'Project Management to perform plan, manage, and execute projects',
    setup: setup(
      ['list', 'board', 'team', 'calendar'],
      PRODUCT_ENGINEERING_STATUSES,
      WORK_STARTER_ORGANIZER,
    ),
  },
]

export const WORKFLOW_TEMPLATES_BY_ID = Object.fromEntries(
  WORKFLOW_TEMPLATE_LIST.map((template) => [template.id, template]),
) as Record<WorkflowTemplateId, WorkflowTemplate>

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
