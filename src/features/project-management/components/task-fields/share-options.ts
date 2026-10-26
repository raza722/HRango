import type { ShareAccess } from '../../types/pm.types'

/** Access levels of people a task or list is shared with (`share_member.access_level`). */
export const SHARE_ACCESS_LABELS: Record<ShareAccess, string> = {
  full_edit: 'Full Edit',
  limited: 'Limited',
  commenter: 'Commenter',
}

/** "Share Tasks Properties": what people the task is shared with can see (API codes). */
export const SHARE_PROPERTIES = [
  { id: 'task_name_status', label: 'Task Name & Status (Required)', required: true },
  { id: 'assignee', label: 'Assignee', required: false },
  { id: 'priority', label: 'Priority', required: false },
  { id: 'due_date', label: 'Due Date', required: false },
  { id: 'description', label: 'Description', required: false },
  { id: 'comments', label: 'Comments', required: false },
  { id: 'subtasks', label: 'Subtask', required: false },
  { id: 'attachments', label: 'Attachments', required: false },
  { id: 'custom_fields', label: 'Custom Fields', required: false },
  { id: 'checklists', label: 'Checklists', required: false },
  { id: 'tags', label: 'Tags', required: false },
  { id: 'cover_image', label: 'Cover Images', required: false },
] as const
