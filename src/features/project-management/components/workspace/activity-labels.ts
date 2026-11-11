import { format, parseISO } from 'date-fns'

import { PRIORITY_META } from '../../constants'
import type { Priority } from '../../types/pm.types'

/**
 * What each action is called in the Action filter and the CSV. The API's action names are not
 * documented; these are the ones the mock writes, and any other name is shown as it comes.
 */
export const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Changed',
  deleted: 'Deleted',
  commented: 'Commented',
  extension_requested: 'Extension requested',
  extension_approved: 'Extension approved',
  extension_rejected: 'Extension rejected',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  start_date: 'Start date',
  due_date: 'Due date',
  assignees: 'Assignees',
  task_list: 'List',
  tags: 'Tags',
  time_estimate: 'Time estimate',
}

/** `dueDate` and `due_date` alike. */
const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function humanise(name: string): string {
  const words = snake(name).replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? humanise(action)
export const fieldLabel = (field: string) => FIELD_LABELS[snake(field)] ?? humanise(field)

/** A logged value as people read it: dates as `5 Nov 2026`, priorities by their label. */
export function valueText(field: string, value: string): string {
  const name = snake(field)
  if (name.endsWith('date') && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return format(parseISO(value.slice(0, 10)), 'd MMM yyyy')
  }
  if (name === 'priority' && value in PRIORITY_META) return PRIORITY_META[value as Priority].label
  return value
}
