import { loadAirTicketsLookups } from './kinds/air-tickets/air-tickets.lookups'
import { loadExpenseLookups } from './kinds/expense/expense.lookups'
import { loadLeaveLookups } from './kinds/leave/leave.lookups'
import { loadLoanAdvancesLookups } from './kinds/loan-advances/loan-advances.lookups'
import { loadOfficialVisitsLookups } from './kinds/official-visits/official-visits.lookups'
import { loadPromotionLookups } from './kinds/promotion/promotion.lookups'
import { loadRelaxationLookups } from './kinds/relaxation/relaxation.lookups'
import { loadRequisitionLookups } from './kinds/requisition/requisition.lookups'
import { loadResignationLookups } from './kinds/resignation/resignation.lookups'
import { loadRestDaysLookups } from './kinds/rest-days/rest-days.lookups'
import { loadTravelLookups } from './kinds/travel/travel.lookups'
import { loadWorkFromHomeLookups } from './kinds/work-from-home/work-from-home.lookups'
import type { StandardKind } from './standard.types'

/**
 * Each type's own look-ups (`extra` of `useStandardLookups`), read from the
 * modules that own them (leave types, loan types, roster groups …). Kept apart
 * from the configs so the API layer does not import components.
 */
export const STANDARD_EXTRA_LOOKUPS: Partial<
  Record<StandardKind, (signal?: AbortSignal) => Promise<object>>
> = {
  'air-tickets': loadAirTicketsLookups,
  expense: loadExpenseLookups,
  leave: loadLeaveLookups,
  'loan-advances': loadLoanAdvancesLookups,
  'official-visits': loadOfficialVisitsLookups,
  promotion: loadPromotionLookups,
  relaxation: loadRelaxationLookups,
  requisition: loadRequisitionLookups,
  resignation: loadResignationLookups,
  'rest-days': loadRestDaysLookups,
  travel: loadTravelLookups,
  'work-from-home': loadWorkFromHomeLookups,
}
