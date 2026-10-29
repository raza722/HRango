import type { HttpHandler } from 'msw'

import { leaveApplicationHandlers } from './applications'
import {
  leaveEncashments,
  leaveLedger,
  leavePolicies,
  leaveSettingsStore,
  leaveTypeStore,
} from './db'
import { allotSeed } from './rules'
import { leaveSettingsHandlers } from './settings-handlers'

/**
 * Leaves endpoints, as backend/app/routers/leaves.py answers them: My Leaves / Leave
 * Applications, balances, ledger, allotment, carry forward, encashment and Settings (general
 * settings, leave types, leave policies with enrolment). Applying, cancelling and deciding are
 * the requests API's (`/requests/leave…`, `/requests/approvals…`, `src/mocks/requests/standard`),
 * over the one store of leave requests both modules read (`./requests.ts`).
 */
export const leavesHandlers: HttpHandler[] = [...leaveApplicationHandlers, ...leaveSettingsHandlers]

// The seed's leave year is allotted, so the balances have credits from the start.
allotSeed()

/**
 * Restores the Leaves tables to their seed data (and allots the current year again). The
 * leave requests are reset with the Requests tables (`resetStandardRequestsDb`).
 */
export function resetLeavesDb(): void {
  leaveTypeStore.reset()
  leavePolicies.reset()
  leaveSettingsStore.reset()
  leaveEncashments.reset()
  leaveLedger.reset()
  allotSeed()
}
