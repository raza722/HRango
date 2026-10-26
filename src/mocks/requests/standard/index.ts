import { createMockCollection } from '../../collection'
import { approvalHandlers } from '../backend'
import type { StandardKindModule, StoredStandardRequest } from './engine'
import { airTicketsServer } from './kinds/air-tickets'
import { bindExpenseRecords, expenseServer, resetExpenseSettingsDb } from './kinds/expense'
import { leaveServer } from './kinds/leave'
import { loanAdvancesServer } from './kinds/loan-advances'
import { officialVisitsServer } from './kinds/official-visits'
import { promotionServer } from './kinds/promotion'
import { relaxationServer } from './kinds/relaxation'
import { requisitionServer } from './kinds/requisition'
import { resignationServer } from './kinds/resignation'
import { restDaysServer } from './kinds/rest-days'
import { travelServer } from './kinds/travel'
import { workFromHomeServer } from './kinds/work-from-home'

/**
 * Every standard request type's server module. A type is added here and in
 * `src/features/requests/standard/registry.ts`.
 */
const SERVERS: readonly StandardKindModule[] = [
  airTicketsServer,
  expenseServer,
  leaveServer,
  loanAdvancesServer,
  officialVisitsServer,
  promotionServer,
  relaxationServer,
  requisitionServer,
  resignationServer,
  restDaysServer,
  travelServer,
  workFromHomeServer,
]

/** All standard requests in one table; each type reads its own `kind`. */
export const standardRequests = createMockCollection<StoredStandardRequest>({
  storageKey: 'hrms-mock-standard-requests',
  seed: () => SERVERS.flatMap((server) => server.seed()),
})

/**
 * The standard types' endpoints, after the shared Approvals screen
 * (`/requests/approvals…`, which reads every type that registered with it).
 */
export const standardRequestHandlers = [
  ...SERVERS.flatMap((server) => server.handlers(standardRequests)),
  ...approvalHandlers,
]

bindExpenseRecords(() => standardRequests.all().filter((record) => record.kind === 'expense'))

export function resetStandardRequestsDb(): void {
  standardRequests.reset()
  resetExpenseSettingsDb()
}
