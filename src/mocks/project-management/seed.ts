import { addDays, format, subDays } from 'date-fns'

import type { StatusDto, TemplateDto } from '@/features/project-management/api/pm.dto'

import { DIRECTORY } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'
import type {
  AttachmentRecord,
  ColumnPermissionRecord,
  CommentRecord,
  CustomFieldRecord,
  DependencyRecord,
  FavoriteRecord,
  FolderRecord,
  ListRecord,
  TagRecord,
  TaskRecord,
  TimeEntryRecord,
  ViewRecord,
  WorkspaceRecord,
} from './db'

/** The mock's signed-in person (Shelley Kannes) and her account. */
export const ME = CURRENT_EMPLOYEE_ID
export const ME_USER_ID = 'usr_shelley'

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
/** UTC instants without an offset, as the API writes them. */
const at = (daysAgo: number, hour = 10) => {
  const date = subDays(new Date(), daysAgo)
  date.setUTCHours(hour, 30, 0, 0)
  return date.toISOString().slice(0, 19)
}

let version = 0x2000
/** A fresh row version (16 hex digits, as the API sends them). */
export const nextRowVersion = () => {
  version += 1
  return version.toString(16).padStart(16, '0')
}

// --- templates (backend db/seeds/0150_pm_templates.sql) ----------------------------------------------

const FEATURES = [
  ['priority', 'Priority'],
  ['custom_fields', 'Add Fields'],
  ['remap_subtask_due_dates', 'Remap Subtask Due Dates'],
  ['multiple_assignees', 'Multiple Assignees'],
  ['story_points', 'Story Points'],
  ['tags', 'Tags'],
  ['time_estimate', 'Time Estimate'],
  ['time_tracking', 'Time Tracking'],
  ['incomplete_warning', 'Incomplete Warnings'],
  ['dependency_warning', 'Dependencies Warning'],
  ['reschedule_dependencies', 'Reschedule Dependencies'],
  ['show_status_progress', 'Show Status Progress'],
].map(([featureCode = '', name = '']) => ({ featureCode, name }))

type S = [string, string, string]
const statuses = (list: S[]) =>
  list.map(([name, color, statusGroup]) => ({ name, color, statusGroup }))
const views = (list: string[]) =>
  list.map((viewType, index) => ({
    viewType,
    name: `${viewType.charAt(0).toUpperCase()}${viewType.slice(1)}`,
    isDefault: index === 0,
  }))

const template = (
  id: string,
  code: string,
  name: string,
  description: string,
  viewList: string[],
  statusList: S[],
  withFeatures: boolean,
): TemplateDto => ({
  id,
  code,
  name,
  description,
  views: views(viewList),
  statuses: statuses(statusList),
  features: withFeatures ? FEATURES : [],
})

export const WORKFLOW_TEMPLATES: TemplateDto[] = [
  template(
    '9',
    'work_starter',
    'Work Starter',
    'Everyday tasks.',
    ['list', 'board'],
    [
      ['To Do', '#979797', 'not_started'],
      ['In-Progress', '#2F639A', 'active'],
      ['Completed', '#318845', 'closed'],
    ],
    true,
  ),
  template(
    '8',
    'project_management',
    'Project Management',
    'Plan, manage and execute projects.',
    ['list', 'board', 'calendar', 'gantt', 'team'],
    [
      ['To Do', '#979797', 'not_started'],
      ['Planning', '#762AFD', 'active'],
      ['In-Progress', '#2F639A', 'active'],
      ['At Risk', '#DC3545', 'active'],
      ['Update Required', '#E9540D', 'active'],
      ['Completed', '#318845', 'closed'],
    ],
    true,
  ),
  template(
    '6',
    'marketing_team',
    'Marketing Team',
    'Run effective campaigns and strategies.',
    ['list', 'board', 'team', 'calendar'],
    [
      ['Backlog', '#979797', 'not_started'],
      ['Planning', '#762AFD', 'active'],
      ['In-Progress', '#2F639A', 'active'],
      ['Ready for Review', '#2E64E2', 'active'],
      ['Update Required', '#B2B22F', 'active'],
      ['On Hold', '#9A782F', 'active'],
      ['Completed', '#318845', 'closed'],
    ],
    true,
  ),
  template(
    '7',
    'product_engineering',
    'Product & Engineering',
    'Plan, build and ship products.',
    ['list', 'board', 'team', 'calendar'],
    [
      ['Backlog', '#979797', 'not_started'],
      ['Planning', '#762AFD', 'active'],
      ['In-Progress', '#2F639A', 'active'],
      ['Ready for Review', '#2E64E2', 'active'],
      ['Completed', '#318845', 'closed'],
    ],
    true,
  ),
]

export const STATUS_TEMPLATES: TemplateDto[] = [
  template(
    '2',
    'custom',
    'Normal/Custom',
    'Basic statuses for general task management.',
    [],
    [
      ['Not Started', '#979797', 'not_started'],
      ['In Progress', '#2F639A', 'active'],
      ['Done', '#4DDC00', 'done'],
      ['Closed', '#318845', 'closed'],
    ],
    false,
  ),
  template(
    '1',
    'content',
    'Content',
    'Content creation workflows.',
    [],
    [
      ['Not Started', '#979797', 'not_started'],
      ['Ready', '#2F669A', 'active'],
      ['Writing', '#562F9A', 'active'],
      ['Approval', '#389A2F', 'active'],
      ['Rejected', '#9A2F2F', 'active'],
      ['Publish', '#619A2F', 'active'],
      ['Done', '#4DDC00', 'done'],
      ['Closed', '#318845', 'closed'],
    ],
    false,
  ),
  template(
    '3',
    'kanban',
    'Kanban',
    'Tasks managed on a Kanban board.',
    [],
    [
      ['Not Started', '#979797', 'not_started'],
      ['In Progress', '#2F639A', 'active'],
      ['Review', '#562F9A', 'active'],
      ['Done', '#4DDC00', 'done'],
      ['Closed', '#318845', 'closed'],
    ],
    false,
  ),
  template(
    '4',
    'marketing',
    'Marketing',
    'Marketing projects.',
    [],
    [
      ['Not Started', '#979797', 'not_started'],
      ['Concept', '#2F639A', 'active'],
      ['In Progress', '#562F9A', 'active'],
      ['Running', '#4DDC00', 'active'],
      ['Review', '#DC1200', 'active'],
      ['Done', '#619A2F', 'done'],
      ['Closed', '#318845', 'closed'],
    ],
    false,
  ),
  template(
    '5',
    'scrum',
    'Scrum',
    'Agile sprints.',
    [],
    [
      ['Not Started', '#979797', 'not_started'],
      ['Pending', '#2F639A', 'active'],
      ['In Progress', '#562F9A', 'active'],
      ['Completed', '#4DDC00', 'active'],
      ['In Review', '#DC9600', 'active'],
      ['Accepted', '#0072DC', 'active'],
      ['Rejected', '#DC1200', 'active'],
      ['Blocked', '#DC5C00', 'active'],
      ['Done', '#619A2F', 'done'],
      ['Closed', '#318845', 'closed'],
    ],
    false,
  ),
]

// --- departments (organisation lookups) ------------------------------------------------------------

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_')

/** The directory's departments as `GET /organisation/lookups/departments` lists them. */
export const DEPARTMENTS = [...new Set(DIRECTORY.map((employee) => employee.department))]
  .sort()
  .map((name) => ({ id: `dep_${slug(name)}`, name }))

export const departmentId = (name: string) => `dep_${slug(name)}`

// --- workspaces ------------------------------------------------------------------------------------

const status = (
  id: string,
  name: string,
  color: string,
  group: string,
  order: number,
): StatusDto => ({
  id,
  name,
  color,
  statusGroup: group,
  sortOrder: order,
  wipLimit: null,
})

const starterStatuses = (prefix: string) => [
  status(`${prefix}todo`, 'To Do', '#979797', 'not_started', 10),
  status(`${prefix}progress`, 'In-Progress', '#2F639A', 'active', 20),
  status(`${prefix}completed`, 'Completed', '#318845', 'closed', 30),
]

const workspace = (
  id: string,
  name: string,
  department: string,
  ownerId: string,
  members: [string, string][],
  statusPrefix: string,
  description: string | null = null,
): WorkspaceRecord => ({
  id,
  name,
  description,
  privacy: 'private',
  departmentId: departmentId(department),
  ownerId,
  workflowTemplate: 'work_starter',
  statusMode: 'default',
  statusTemplate: null,
  statuses: starterStatuses(statusPrefix),
  features: FEATURES.map((feature) => ({ featureCode: feature.featureCode, settingValue: null })),
  members: members.map(([employeeId, memberRole]) => ({ employeeId, memberRole })),
  cover: null,
  createdAt: at(30),
  updatedAt: null,
  rowVersion: nextRowVersion(),
})

export function seedWorkspaces(): WorkspaceRecord[] {
  return [
    workspace(
      'ws_uxui',
      'UX/UI Design Team Work Space',
      'Software',
      ME,
      [
        [ME, 'workspace_admin'],
        ['em_bilal', 'manager'],
        ['em_haroon', 'team_leader'],
        ['em_rehan', 'contributor'],
        ['em_saad', 'contributor'],
        ['em_areeba', 'contributor'],
        ['em_jack', 'contributor'],
        ['em_faisal', 'contributor'],
      ],
      'st_',
      'This workspace specially create for UX/UI Design Team members. In this workspace admin will allocate different type of tasks regard UX research and UI Designing.',
    ),
    workspace(
      'ws_research',
      'User Research & Planning',
      'Marketing',
      ME,
      [
        [ME, 'workspace_admin'],
        ['em_jack', 'contributor'],
      ],
      'st_r_',
    ),
    workspace(
      'ws_qa',
      'QA Testing Phase',
      'Software',
      'em_bilal',
      [
        ['em_bilal', 'workspace_admin'],
        [ME, 'hr'],
      ],
      'st_q_',
    ),
  ]
}

const view = (
  id: string,
  workspaceId: string,
  viewType: string,
  name: string,
  isDefault: boolean,
  order: number,
): ViewRecord => ({
  id,
  workspaceId,
  taskListId: null,
  viewType,
  name,
  config: null,
  isPinned: false,
  isPrivate: false,
  isProtected: false,
  isDefault,
  isRequired: viewType === 'list',
  sortOrder: order,
  ownerId: null,
  rowVersion: nextRowVersion(),
})

export function seedViews(): ViewRecord[] {
  return ['ws_uxui', 'ws_research', 'ws_qa'].flatMap((id) => [
    view(`vw_${id}_list`, id, 'list', 'List', true, 10),
    view(`vw_${id}_board`, id, 'board', 'Board', false, 20),
  ])
}

/** "Workspace Navigation" (411:146521): two folders of lists. */
export function seedFolders(): FolderRecord[] {
  return [
    {
      id: 'fd_ux_process',
      workspaceId: 'ws_uxui',
      name: 'UX Design Process',
      sortOrder: 10,
      rowVersion: nextRowVersion(),
    },
    {
      id: 'fd_research',
      workspaceId: 'ws_uxui',
      name: 'User Research & Planning',
      sortOrder: 20,
      rowVersion: nextRowVersion(),
    },
  ]
}

const list = (id: string, folderId: string, name: string, order: number): ListRecord => ({
  id,
  workspaceId: 'ws_uxui',
  folderId,
  name,
  privacy: 'workspace',
  color: null,
  description: null,
  startAt: null,
  endAt: null,
  priority: null,
  sortOrder: order,
  lastModifiedAt: null,
  memberIds: [],
  rowVersion: nextRowVersion(),
})

export function seedLists(): ListRecord[] {
  return [
    list('it_flow', 'fd_ux_process', 'User Flow and Information Architecture', 11),
    list('it_wire', 'fd_ux_process', 'Low & High Fidelity Wire-frames', 12),
    list('it_ui', 'fd_ux_process', 'User Interface & Prototyping', 13),
    list('it_user_research', 'fd_research', 'User Research', 21),
    list('it_quali', 'fd_research', 'Qualitative & Quantitative Research', 22),
    list('it_info', 'fd_research', 'Information Gathering', 23),
  ]
}

export const seedColumnPermissions = (): ColumnPermissionRecord[] => []

/** Labels are a custom field of type labels (backend decision). */
export const LABELS_FIELD_ID = 'fld_labels'

export function seedCustomFields(): CustomFieldRecord[] {
  return [
    {
      id: LABELS_FIELD_ID,
      workspaceId: 'ws_uxui',
      name: 'Labels',
      fieldType: 'labels',
      description: null,
      config: {
        options: ['Ready for UI Design', 'Ready for QA', 'Prototype Testing', 'Usability Testing'],
        sort: 'manual',
      },
      sortOrder: 10,
      rowVersion: nextRowVersion(),
    },
  ]
}

export function seedTags(): TagRecord[] {
  return [
    { id: 'tg_bug', workspaceId: 'ws_uxui', name: 'Bug Issue', color: '#E5383B' },
    { id: 'tg_active', workspaceId: 'ws_uxui', name: 'Active', color: '#2CBD4D' },
    { id: 'tg_revamp', workspaceId: 'ws_uxui', name: 'Revamp', color: '#0BA5EC' },
  ].map((tag) => ({ ...tag, rowVersion: nextRowVersion() }))
}

// --- tasks -------------------------------------------------------------------------------------------

let order = 0
const task = (
  id: string,
  number: number,
  listId: string | null,
  name: string,
  statusId: string,
  extra: Partial<TaskRecord> = {},
): TaskRecord => ({
  id,
  workspaceId: 'ws_uxui',
  taskListId: listId,
  parentTaskId: null,
  code: `HR${String(number).padStart(9, '0')}`,
  name,
  description: null,
  taskType: 'task',
  statusId,
  priority: null,
  startDate: null,
  startTime: null,
  dueDate: null,
  dueTime: null,
  timeEstimateMinutes: null,
  rating: null,
  url: null,
  recurrence: null,
  closedAt: null,
  sortOrder: (order += 10),
  createdByUserId: ME_USER_ID,
  createdByName: 'Shelley Kannes',
  createdAt: at(10),
  updatedAt: null,
  assignees: [],
  tagIds: [],
  fieldValues: [],
  cover: null,
  rowVersion: nextRowVersion(),
  ...extra,
})

const assigned = (...ids: string[]) => ids.map((employeeId) => ({ employeeId, storyPoints: null }))
const labels = (...names: string[]) => [
  { customFieldId: LABELS_FIELD_ID, fieldValue: JSON.stringify(names) },
]

export function seedTasks(): TaskRecord[] {
  order = 0
  return [
    task('tk_quali', 1, 'it_quali', 'User Qualitative Research', 'st_todo', {
      assignees: [
        { employeeId: ME, storyPoints: 5 },
        { employeeId: 'em_bilal', storyPoints: 3 },
        ...assigned('em_haroon', 'em_rehan', 'em_saad'),
      ],
      startDate: day(0),
      dueDate: day(7),
      priority: 'urgent',
      tagIds: ['tg_active'],
      description: 'Interview ten users of the old portal and summarise their pain points.',
      timeEstimateMinutes: 480,
      rating: 2,
    }),
    task('tk_quali_a', 2, 'it_quali', 'Prepare interview questions', 'st_todo', {
      parentTaskId: 'tk_quali',
      assignees: assigned(ME),
      dueDate: day(2),
      priority: 'high',
    }),
    task('tk_quali_b', 3, 'it_quali', 'Book interview slots', 'st_progress', {
      parentTaskId: 'tk_quali',
      assignees: assigned('em_bilal'),
      dueDate: day(3),
      priority: 'normal',
    }),
    task('tk_persona', 4, 'it_user_research', 'User Persona List', 'st_todo', {
      assignees: assigned('em_areeba', 'em_jack'),
      startDate: day(-3),
      dueDate: day(4),
      priority: 'high',
      tagIds: ['tg_revamp'],
    }),
    task('tk_flow', 5, 'it_flow', 'Iteration List', 'st_progress', {
      assignees: assigned('em_haroon'),
      startDate: day(-5),
      dueDate: day(1),
      priority: 'normal',
      fieldValues: labels('Ready for UI Design'),
    }),
    task('tk_wire', 6, 'it_wire', 'Low fidelity wire-frames for Create Workspace', 'st_progress', {
      assignees: assigned('em_rehan', ME),
      startDate: day(-2),
      dueDate: day(5),
      priority: 'low',
      tagIds: ['tg_bug'],
    }),
    task('tk_ui', 7, 'it_ui', 'Prototype the List view', 'st_completed', {
      assignees: assigned('em_saad'),
      startDate: day(-12),
      dueDate: day(-2),
      priority: 'normal',
      closedAt: at(2),
      fieldValues: labels('Prototype Testing'),
    }),
  ]
}

/** User Persona List waits on User Qualitative Research. */
export const seedDependencies = (): DependencyRecord[] => [
  { id: 'dep_1', taskId: 'tk_persona', otherTaskId: 'tk_quali', kind: 'waiting_on' },
]

export function seedTimeEntries(): TimeEntryRecord[] {
  const start = new Date()
  start.setDate(start.getDate() - 1)
  start.setHours(15, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60_000)
  return [
    {
      id: 'te_1',
      taskId: 'tk_quali',
      employeeId: ME,
      startAt: start.toISOString().slice(0, 19),
      endAt: end.toISOString().slice(0, 19),
      minutes: 60,
      isRunning: false,
      notes: 'Interview guide',
      rowVersion: nextRowVersion(),
    },
  ]
}

export const seedAttachments = (): AttachmentRecord[] => []

export function seedComments(): CommentRecord[] {
  return [
    {
      id: 'cm_1',
      taskId: 'tk_quali',
      parentId: null,
      authorId: 'em_bilal',
      body: '@Shelley Kannes Complete this task ASAP',
      createdAt: at(1, 12),
      editedAt: null,
      assignedToId: ME,
      assignedById: 'em_bilal',
      isResolved: false,
      resolvedById: null,
      resolvedAt: null,
      reactions: [],
      mentions: [{ employeeId: ME, name: 'Shelley Kannes' }],
      rowVersion: nextRowVersion(),
    },
    {
      id: 'cm_2',
      taskId: 'tk_quali',
      parentId: 'cm_1',
      authorId: ME,
      body: 'On it, the interview guide is ready.',
      createdAt: at(0, 4),
      editedAt: null,
      assignedToId: null,
      assignedById: null,
      isResolved: false,
      resolvedById: null,
      resolvedAt: null,
      reactions: [{ employeeId: 'em_bilal', reaction: 'like' }],
      mentions: [],
      rowVersion: nextRowVersion(),
    },
  ]
}

/** The UX/UI workspace is a favourite. */
export const seedFavorites = (): FavoriteRecord[] => [
  {
    id: 'fav_1',
    entityType: 'workspace',
    entityId: 'ws_uxui',
    kind: 'favorite',
    createdAt: at(20),
  },
]
