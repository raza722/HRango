import { z } from 'zod'

import { SETTINGS_TABS, type SettingsTab } from './constants'

const TAB_VALUES = SETTINGS_TABS.map((tab) => tab.value) as [SettingsTab, ...SettingsTab[]]

/** E-Budget Settings: the tab (Budget Duration, Position Title, Employee Position) and page. */
export const budgetSettingsSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).default('budget-duration').catch('budget-duration'),
  page: z.number().int().min(1).default(1).catch(1),
})
export type BudgetSettingsSearch = z.infer<typeof budgetSettingsSearchSchema>
export const BUDGET_SETTINGS_SEARCH_DEFAULTS = { tab: 'budget-duration', page: 1 } as const
