import { addDays, format, subDays } from 'date-fns'

import {
  DEFAULT_VISIBLE_COLUMNS,
  type ListColumn,
  type ShareSettings,
  type Tag,
  type Task,
  TASK_COLUMN_KEYS,
  type TaskComment,
  WORKFLOW_TEMPLATES_BY_ID,
  type Workspace,
  type WorkspaceItem,
} from '@/features/project-management'

import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'

const ME = CURRENT_EMPLOYEE_ID
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
const at = (daysAgo: number, hour = 10) => {
  const date = subDays(new Date(), daysAgo)
  date.setHours(hour, 30, 0, 0)
  return date.toISOString()
}

export const columnsFor = (visible: readonly string[] = DEFAULT_VISIBLE_COLUMNS): ListColumn[] =>
  TASK_COLUMN_KEYS.map((key) => ({
    key,
    visible: visible.includes(key),
    permission: { defaultLevel: 'default', roles: {}, members: [] },
  }))

const workStarter = WORKFLOW_TEMPLATES_BY_ID['work-starter']

const workspace = (
  id: string,
  name: string,
  department: string,
  ownerId: string,
  memberIds: string[],
  favorite: boolean,
  description = '',
): Workspace => ({
  id,
  name,
  description,
  ownerId,
  visibility: 'private',
  memberIds,
  department,
  template: 'work-starter',
  setup: structuredClone(workStarter.setup),
  coverUrl: null,
  favorite,
  createdById: ME,
  createdAt: at(30),
  columns: columnsFor(),
})

export function seedWorkspaces(): Workspace[] {
  return [
    workspace(
      'ws_uxui',
      'UX/UI Design Team Work Space',
      'Software',
      ME,
      [ME, 'em_bilal', 'em_haroon', 'em_rehan', 'em_saad', 'em_areeba', 'em_jack', 'em_faisal'],
      true,
      'This workspace specially create for UX/UI Design Team members. In this workspace admin will allocate different type of tasks regard UX research and UI Designing.',
    ),
    workspace('ws_research', 'User Research & Planning', 'Marketing', ME, [ME, 'em_jack'], false),
    workspace('ws_qa', 'QA Testing Phase', 'Software', 'em_bilal', [ME, 'em_bilal'], false),
  ]
}

const item = (
  id: string,
  workspaceId: string,
  parentId: string | null,
  kind: WorkspaceItem['kind'],
  name: string,
  order: number,
): WorkspaceItem => ({ id, workspaceId, parentId, kind, name, favorite: false, order })

/** "Workspace Navigation" (411:146521): two folders of lists and docs. */
export function seedItems(): WorkspaceItem[] {
  return [
    item('it_ux_process', 'ws_uxui', null, 'folder', 'UX Design Process', 0),
    item(
      'it_flow',
      'ws_uxui',
      'it_ux_process',
      'list',
      'User Flow and Information Architecture',
      0,
    ),
    item('it_wire', 'ws_uxui', 'it_ux_process', 'list', 'Low & High Fidelity Wire-frames', 1),
    item('it_ui', 'ws_uxui', 'it_ux_process', 'list', 'User Interface & Prototyping', 2),
    item('it_brd', 'ws_uxui', 'it_ux_process', 'doc', 'BRD for Task Management Module', 3),
    item('it_qa_doc', 'ws_uxui', 'it_ux_process', 'doc', 'QA Testing Document', 4),
    item('it_research', 'ws_uxui', null, 'folder', 'User Research & Planning', 1),
    item('it_user_research', 'ws_uxui', 'it_research', 'list', 'User Research', 0),
    item('it_quali', 'ws_uxui', 'it_research', 'list', 'Qualitative & Quantitative Research', 1),
    item('it_info', 'ws_uxui', 'it_research', 'list', 'Information Gathering', 2),
  ]
}

export function seedTags(): Tag[] {
  return [
    { id: 'tg_bug', workspaceId: 'ws_uxui', kind: 'tag', name: 'Bug Issue', color: '#E5383B' },
    { id: 'tg_active', workspaceId: 'ws_uxui', kind: 'tag', name: 'Active', color: '#2CBD4D' },
    { id: 'tg_revamp', workspaceId: 'ws_uxui', kind: 'tag', name: 'Revamp', color: '#0BA5EC' },
    {
      id: 'lb_ready_ui',
      workspaceId: 'ws_uxui',
      kind: 'label',
      name: 'Ready for UI Design',
      color: '#7127EA',
    },
    {
      id: 'lb_ready_qa',
      workspaceId: 'ws_uxui',
      kind: 'label',
      name: 'Ready for QA',
      color: '#F79009',
    },
    {
      id: 'lb_proto',
      workspaceId: 'ws_uxui',
      kind: 'label',
      name: 'Prototype Testing',
      color: '#2E64E2',
    },
    {
      id: 'lb_usability',
      workspaceId: 'ws_uxui',
      kind: 'label',
      name: 'Usability Testing',
      color: '#12B76A',
    },
  ]
}

let order = 0
const task = (
  id: string,
  number: number,
  listId: string | null,
  name: string,
  statusId: string,
  extra: Partial<Task> = {},
): Task => ({
  id,
  code: `#HR${String(number).padStart(9, '0')}`,
  workspaceId: 'ws_uxui',
  listId,
  parentId: null,
  name,
  description: '',
  statusId,
  type: 'task',
  assigneeIds: [],
  invitedEmails: [],
  startDate: null,
  startTime: null,
  dueDate: null,
  dueTime: null,
  recurrence: null,
  priority: null,
  tagIds: [],
  labelIds: [],
  waitingOn: [],
  blocking: [],
  storyPoints: [],
  rating: 0,
  timeEstimateMinutes: null,
  timeEntries: [],
  timerStartedAt: null,
  attachments: [],
  reminderAt: null,
  favorite: false,
  createdById: ME,
  createdAt: at(10),
  closedAt: null,
  order: (order += 1),
  ...extra,
})

export function seedTasks(): Task[] {
  order = 0
  return [
    task('tk_quali', 1, 'it_quali', 'User Qualitative Research', 'st_todo', {
      blocking: ['tk_persona'],
      assigneeIds: [ME, 'em_bilal', 'em_haroon', 'em_rehan', 'em_saad'],
      startDate: day(0),
      dueDate: day(7),
      priority: 'urgent',
      tagIds: ['tg_active'],
      description: 'Interview ten users of the old portal and summarise their pain points.',
      timeEstimateMinutes: 480,
      storyPoints: [
        { employeeId: ME, points: 5 },
        { employeeId: 'em_bilal', points: 3 },
      ],
      rating: 2,
      timeEntries: [
        {
          id: 'te_1',
          employeeId: ME,
          date: day(-1),
          start: '15:00',
          end: '16:00',
          minutes: 60,
          notes: 'Interview guide',
        },
      ],
    }),
    task('tk_quali_a', 2, 'it_quali', 'Prepare interview questions', 'st_todo', {
      parentId: 'tk_quali',
      assigneeIds: [ME],
      dueDate: day(2),
      priority: 'high',
    }),
    task('tk_quali_b', 3, 'it_quali', 'Book interview slots', 'st_progress', {
      parentId: 'tk_quali',
      assigneeIds: ['em_bilal'],
      dueDate: day(3),
      priority: 'normal',
    }),
    task('tk_persona', 4, 'it_user_research', 'User Persona List', 'st_todo', {
      assigneeIds: ['em_areeba', 'em_jack'],
      startDate: day(-3),
      dueDate: day(4),
      priority: 'high',
      tagIds: ['tg_revamp'],
      waitingOn: ['tk_quali'],
    }),
    task('tk_flow', 5, 'it_flow', 'Iteration List', 'st_progress', {
      assigneeIds: ['em_haroon'],
      startDate: day(-5),
      dueDate: day(1),
      priority: 'normal',
      labelIds: ['lb_ready_ui'],
    }),
    task('tk_wire', 6, 'it_wire', 'Low fidelity wire-frames for Create Workspace', 'st_progress', {
      assigneeIds: ['em_rehan', ME],
      startDate: day(-2),
      dueDate: day(5),
      priority: 'low',
      tagIds: ['tg_bug'],
    }),
    task('tk_ui', 7, 'it_ui', 'Prototype the List view', 'st_completed', {
      assigneeIds: ['em_saad'],
      startDate: day(-12),
      dueDate: day(-2),
      priority: 'normal',
      closedAt: at(2),
      labelIds: ['lb_proto'],
    }),
  ]
}

export function seedComments(): TaskComment[] {
  return [
    {
      id: 'cm_1',
      taskId: 'tk_quali',
      parentId: null,
      authorId: 'em_bilal',
      body: '@Shelley Kannes Complete this task ASAP',
      createdAt: at(1, 17),
      editedAt: null,
      assignedToId: ME,
      assignedById: 'em_bilal',
      resolved: false,
      resolvedById: null,
      likedByIds: [],
    },
    {
      id: 'cm_2',
      taskId: 'tk_quali',
      parentId: 'cm_1',
      authorId: ME,
      body: 'On it, the interview guide is ready.',
      createdAt: at(0, 9),
      editedAt: null,
      assignedToId: null,
      assignedById: null,
      resolved: false,
      resolvedById: null,
      likedByIds: ['em_bilal'],
    },
  ]
}

export const seedShares = (): (ShareSettings & { id: string })[] => []
