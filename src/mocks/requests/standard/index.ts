import { createMockCollection } from '../../collection'
import type { StandardKindModule, StoredStandardRequest } from './engine'
import { leaveServer } from './kinds/leave'
import { loanAdvancesServer } from './kinds/loan-advances'
import { promotionServer } from './kinds/promotion'
import { relaxationServer } from './kinds/relaxation'
import { resignationServer } from './kinds/resignation'
import { restDaysServer } from './kinds/rest-days'
import { travelServer } from './kinds/travel'
import { workFromHomeServer } from './kinds/work-from-home'

/**
 * Every standard request type's server module. A type is added here and in
 * `src/features/requests/standard/registry.ts`.
 */
const SERVERS: readonly StandardKindModule[] = [
  leaveServer,
  loanAdvancesServer,
  promotionServer,
  relaxationServer,
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

export const standardRequestHandlers = SERVERS.flatMap((server) =>
  server.handlers(standardRequests),
)

export function resetStandardRequestsDb(): void {
  standardRequests.reset()
}
