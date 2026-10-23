import { leaveConfig } from './kinds/leave/leave.config'
import { loanAdvancesConfig } from './kinds/loan-advances/loan-advances.config'
import { promotionConfig } from './kinds/promotion/promotion.config'
import { relaxationConfig } from './kinds/relaxation/relaxation.config'
import { resignationConfig } from './kinds/resignation/resignation.config'
import { restDaysConfig } from './kinds/rest-days/rest-days.config'
import { travelConfig } from './kinds/travel/travel.config'
import { workFromHomeConfig } from './kinds/work-from-home/work-from-home.config'
import type { StandardKind, StandardKindConfig } from './standard.types'

/**
 * The standard request types that are built, by kind. A type is added here
 * and in `src/mocks/requests/standard/index.ts`; the others still open the
 * placeholder.
 */
export const STANDARD_CONFIGS: Partial<Record<StandardKind, StandardKindConfig<never>>> = {
  leave: leaveConfig as unknown as StandardKindConfig<never>,
  'loan-advances': loanAdvancesConfig as unknown as StandardKindConfig<never>,
  promotion: promotionConfig as unknown as StandardKindConfig<never>,
  relaxation: relaxationConfig as unknown as StandardKindConfig<never>,
  resignation: resignationConfig as unknown as StandardKindConfig<never>,
  'rest-days': restDaysConfig as unknown as StandardKindConfig<never>,
  travel: travelConfig as unknown as StandardKindConfig<never>,
  'work-from-home': workFromHomeConfig as unknown as StandardKindConfig<never>,
}
