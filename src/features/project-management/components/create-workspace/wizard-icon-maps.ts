import type { ComponentType, SVGProps } from 'react'
import { ChartGantt, Gauge, Mail, Network, Timer, UsersRound } from 'lucide-react'

import type { OrganizerFeature, StatusGroup, ViewKind } from '../../types/pm.types'
import {
  AddFieldsIcon,
  DependenciesWarningIcon,
  IncompleteWarningsIcon,
  MultipleAssigneesIcon,
  PriorityIcon,
  RemapDueDatesIcon,
  RescheduleDependenciesIcon,
  StatusProgressIcon,
  StoryPointsIcon,
  TagsIcon,
  TimeEstimateIcon,
  TimeTrackingIcon,
} from './organizer-icons'
import {
  ActivityViewIcon,
  BoardViewIcon,
  CalendarViewIcon,
  ListViewIcon,
  TableViewIcon,
  TeamViewIcon,
  TimelineViewIcon,
} from './view-icons'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * View icons. Gantt, Workload and Mind Map are components in the file but on no exported
 * frame, so they fall back to lucide icons.
 */
export const VIEW_ICONS: Record<ViewKind, Icon> = {
  list: ListViewIcon,
  board: BoardViewIcon,
  calendar: CalendarViewIcon,
  activity: ActivityViewIcon,
  team: TeamViewIcon,
  timeline: TimelineViewIcon,
  table: TableViewIcon,
  gantt: ChartGantt,
  workload: UsersRound,
  'mind-map': Network,
}

/** Organizer icons; Email, Sprint Points and WIP Limits are hidden rows with no export. */
export const ORGANIZER_ICONS: Record<OrganizerFeature, Icon> = {
  priority: PriorityIcon,
  'add-fields': AddFieldsIcon,
  'remap-subtask-due-dates': RemapDueDatesIcon,
  'multiple-assignees': MultipleAssigneesIcon,
  'story-points': StoryPointsIcon,
  tags: TagsIcon,
  'time-estimate': TimeEstimateIcon,
  'time-tracking': TimeTrackingIcon,
  'incomplete-warnings': IncompleteWarningsIcon,
  'dependencies-warnings': DependenciesWarningIcon,
  'reschedule-dependencies': RescheduleDependenciesIcon,
  'show-status-progress': StatusProgressIcon,
  email: Mail,
  'sprint-points': Timer,
  'wip-limits': Gauge,
}

// Tooltip copy. The design has tooltip components for these but none was exported, so the
// text is written from each page's own description.

export const SUMMARY_HELP = {
  views:
    'Views created with the workspace. List is always required; the others can be switched on or off.',
  statuses:
    'The statuses tasks move through: the workspace defaults or your own custom statuses, grouped as Not Started, Active, Closed and Done.',
  organizer:
    'Organizer features that tasks in this workspace can use, such as priority, tags and time tracking.',
} as const

export const STATUS_GROUP_HELP: Record<StatusGroup, string> = {
  'not-started': 'Statuses for tasks that have not been started yet.',
  active: 'Statuses for tasks that are being worked on.',
  closed: 'Statuses for tasks that are finished and closed.',
  done: 'Statuses for tasks that are done but still open, for example waiting for approval.',
}

export const ORGANIZER_HELP: Record<OrganizerFeature, string> = {
  priority: 'Set a priority (Urgent, High, Normal or Low) on tasks.',
  'add-fields': 'Add your own custom fields to tasks.',
  'remap-subtask-due-dates': 'Move subtask due dates when the parent task’s dates change.',
  'multiple-assignees': 'Assign a task to more than one person.',
  'story-points': 'Estimate tasks with story points.',
  tags: 'Label tasks with coloured tags.',
  'time-estimate': 'Record how long a task should take.',
  'time-tracking': 'Track the time spent on each task.',
  'incomplete-warnings': 'Warn before closing a task that has open subtasks or checklist items.',
  'dependencies-warnings': 'Warn when a task is closed before the tasks it waits on.',
  'reschedule-dependencies': 'Shift dependent tasks when a task’s dates move.',
  'show-status-progress': 'Show how far a task has moved through its statuses.',
  email: 'Send and receive email from tasks.',
  'sprint-points': 'Plan sprints with points.',
  'wip-limits': 'Limit how many tasks can be in progress at once.',
}
