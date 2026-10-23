import type { HttpHandler } from 'msw'

import { leaveApplicationHandlers } from './applications'
import { resetLeavesDb } from './db'
import { leaveSettingsHandlers } from './settings-handlers'

/**
 * Leaves endpoints: the look-ups, My Leaves / Leave Applications (over the
 * shared leave requests), and Settings (general settings, leave types, leave
 * policies).
 */
export const leavesHandlers: HttpHandler[] = [...leaveApplicationHandlers, ...leaveSettingsHandlers]

export { resetLeavesDb }
