import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  BUDGET_SETTINGS_SEARCH_DEFAULTS,
  budgetSettingsSearchSchema,
  EBudgetSettingsPage,
} from '@/features/manpower-planning'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/manpower-planning/e-budget-settings')({
  validateSearch: budgetSettingsSearchSchema,
  search: { middlewares: [stripSearchParams(BUDGET_SETTINGS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('E-Budget Settings') }] }),
  component: EBudgetSettingsPage,
})
