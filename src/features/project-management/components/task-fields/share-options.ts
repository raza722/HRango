import type { ShareAccess } from '../../types/pm.types'

export const SHARE_ACCESS_LABELS: Record<ShareAccess, string> = {
  'full-edit': 'Full Edit',
  edit: 'Edit All',
  view: 'View',
}

/** "Share Tasks Properties": what people the task is shared with can see. */
export const SHARE_PROPERTIES = [
  { id: 'name-status', label: 'Task Name & Status (Required)', required: true },
  { id: 'assignee', label: 'Assignee', required: false },
  { id: 'priority', label: 'Priority', required: false },
  { id: 'due-date', label: 'Due Date', required: false },
  { id: 'description', label: 'Description', required: false },
  { id: 'comments', label: 'Comments', required: false },
  { id: 'subtask', label: 'Subtask', required: false },
  { id: 'attachments', label: 'Attachments', required: false },
  { id: 'tags', label: 'Tags', required: false },
  { id: 'cover-images', label: 'Cover Images', required: false },
] as const
