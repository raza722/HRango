import type { HttpHandler } from 'msw'

import { leaveApplicationHandlers } from './applications'
import {
  leaveEncashments,
  leaveLedger,
  leavePolicies,
  leaveRequests,
  leaveSettingsStore,
  leaveTypeStore,
} from './db'
import { leaveRequestHandlers } from './request-handlers'
import { allotSeed } from './rules'
import { leaveSettingsHandlers } from './settings-handlers'

/**
 * Leaves endpoints, as backend/app/routers/leaves.py answers them: My Leaves / Leave
 * Applications, balances, ledger, allotment, carry forward, encashment and Settings (general
 * settings, leave types, leave policies with enrolment). `leaveRequestHandlers` (the leave
 * kind of `/requests/...`) is exported for tests and not registered here.
 */
export const leavesHandlers: HttpHandler[] = [...leaveApplicationHandlers, ...leaveSettingsHandlers]

export { leaveRequestHandlers }

// The seed's leave year is allotted, so the balances have credits from the start.
allotSeed()

/** Restores the Leaves tables to their seed data (and allots the current year again). */
export function resetLeavesDb(): void {
  leaveTypeStore.reset()
  leavePolicies.reset()
  leaveSettingsStore.reset()
  leaveRequests.reset()
  leaveEncashments.reset()
  leaveLedger.reset()
  allotSeed()
}
