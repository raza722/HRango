import { OFF_STATUSES } from '../constants'
import type { TimeSheetAction, TimeSheetDay, TimeSheetScope } from '../types/attendance.types'

/**
 * Row actions a day offers. "My" only views its own days; Subordinates and All can also edit a
 * scheduled day that has started and payroll has not frozen (when `canEdit`). Missing Punch,
 * Relaxation, Absent and Overtime are requests in the API (requests module), not time-sheet
 * edits, so the time sheet no longer offers them.
 */
export function rowActions(
  day: TimeSheetDay,
  scope: TimeSheetScope,
  today: string,
  canEdit = true,
): TimeSheetAction[] {
  if (scope === 'my') return ['view']
  const scheduled = !OFF_STATUSES.has(day.dayStatus)
  const started = day.workDate <= today
  const actions: TimeSheetAction[] = []
  if (canEdit && scheduled && started && !day.isFrozen) actions.push('edit')
  actions.push('view')
  return actions
}
