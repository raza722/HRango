import { OFF_STATUSES } from '../constants'
import type { TimeSheetAction, TimeSheetDay, TimeSheetScope } from '../types/attendance.types'

/**
 * Row actions a day offers, in the order of the design's icon key. "My" only
 * views its own days; "All" can also edit a worked day, add a missing punch,
 * relax a late arrival or early leave, record an absence and approve overtime.
 */
export function rowActions(
  day: TimeSheetDay,
  scope: TimeSheetScope,
  today: string,
): TimeSheetAction[] {
  if (scope === 'my') return ['view']
  const scheduled = day.status !== null && !OFF_STATUSES.has(day.status)
  const started = day.date <= today
  const actions: TimeSheetAction[] = []
  if (scheduled && started) actions.push('edit')
  if (day.clockInStatus === 'missing-punch' || day.clockOutStatus === 'missing-punch') {
    actions.push('missing-punch')
  }
  if (
    !day.relaxed &&
    (day.clockInStatus === 'late-arrival' || day.clockOutStatus === 'early-left')
  ) {
    actions.push('relaxation')
  }
  actions.push('view')
  if (day.status === 'absent' && started) actions.push('absent')
  if (day.overtimeMinutes > 0 && day.approvedOvertimeMinutes === null) actions.push('overtime')
  return actions
}
