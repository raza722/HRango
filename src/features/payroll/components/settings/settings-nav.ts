import type { ComponentType, SVGProps } from 'react'

import {
  BenefitBadgeIcon,
  DoorArrowIcon,
  FormulaIcon,
  IncentivesIcon,
  PayItemsIcon,
  PayrollConfigurationIcon,
  RulesIcon,
  TaxRebateIcon,
} from '@/components/icons/payroll-icons'

import { type PayrollSettingsTab, SETTINGS_VIEWS } from '../../routing'

export const TAB_LABELS: Record<PayrollSettingsTab, string> = {
  general: 'General',
  tax: 'Tax',
  rewards: 'Rewards',
  'pay-components': 'Pay Components',
  'account-type': 'Account Type',
  'disbursement-banks': 'Disbursement Banks',
}

export const TAB_PATHS = {
  general: '/payroll/settings/general',
  tax: '/payroll/settings/tax',
  rewards: '/payroll/settings/rewards',
  'pay-components': '/payroll/settings/pay-components',
  'account-type': '/payroll/settings/account-type',
  'disbursement-banks': '/payroll/settings/disbursement-banks',
} as const satisfies Record<PayrollSettingsTab, string>

export type SettingsView = (typeof SETTINGS_VIEWS)[PayrollSettingsTab][number]

/** The sub-tabs under a tab, with their Figma icons. */
export const VIEW_META: Record<
  SettingsView,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  'payroll-configuration': { label: 'Payroll Configuration', icon: PayrollConfigurationIcon },
  'leave-configuration': { label: 'Leave Configuration', icon: DoorArrowIcon },
  'tax-rebate': { label: 'Tax Rebate', icon: TaxRebateIcon },
  'tax-structure': { label: 'Tax Structure', icon: DoorArrowIcon },
  benefits: { label: 'Benefits', icon: BenefitBadgeIcon },
  incentives: { label: 'Incentives', icon: IncentivesIcon },
  'pay-items': { label: 'Pay Items', icon: PayItemsIcon },
  formulas: { label: 'Formulas', icon: FormulaIcon },
  rules: { label: 'Rules', icon: RulesIcon },
}

/** The `?view=` of a tab, falling back to its first sub-tab. */
export function viewOf(tab: PayrollSettingsTab, view: string | undefined): SettingsView | null {
  const views: readonly SettingsView[] = SETTINGS_VIEWS[tab]
  return views.find((item) => item === view) ?? views[0] ?? null
}

/** Rows per page in the Settings lists. */
export const SETTINGS_PAGE_SIZE = 10
