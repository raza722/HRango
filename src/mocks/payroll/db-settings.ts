import type {
  AccountType,
  Benefit,
  DisbursementBank,
  Formula,
  IncentiveRow,
  PayItem,
  PayrollSettings,
  PayRule,
  TaxRebateRow,
  TaxStructure,
} from '@/features/payroll'

import { createMockCollection } from '../collection'
import {
  defaultPayrollSettings,
  seedAccountTypes,
  seedBanks,
  seedBenefits,
  seedFormulas,
  seedIncentives,
  seedPayItems,
  seedRules,
  seedTaxRebates,
  seedTaxStructures,
} from './seed-settings'

// Payroll Settings, stored in the API's shapes.

const key = (name: string) => `hrms-mock-payroll-v2-${name}`

export const payItems = createMockCollection<PayItem>({
  storageKey: key('pay-items'),
  seed: seedPayItems,
})
export const formulas = createMockCollection<Formula>({
  storageKey: key('formulas'),
  seed: seedFormulas,
})
export const payRules = createMockCollection<PayRule>({ storageKey: key('rules'), seed: seedRules })
export const accountTypes = createMockCollection<AccountType>({
  storageKey: key('account-types'),
  seed: seedAccountTypes,
})
export const banks = createMockCollection<DisbursementBank>({
  storageKey: key('banks'),
  seed: seedBanks,
})
export const taxStructures = createMockCollection<TaxStructure>({
  storageKey: key('tax-structures'),
  seed: seedTaxStructures,
})
export const taxRebates = createMockCollection<TaxRebateRow>({
  storageKey: key('tax-rebates'),
  seed: seedTaxRebates,
})
export const benefits = createMockCollection<Benefit>({
  storageKey: key('benefits'),
  seed: seedBenefits,
})
export const incentives = createMockCollection<IncentiveRow>({
  storageKey: key('incentives'),
  seed: seedIncentives,
})
export const payrollSettingsStore = createMockCollection<PayrollSettings & { id: string }>({
  storageKey: key('settings'),
  seed: () => [{ id: 'settings', ...defaultPayrollSettings() }],
})

export const SETTINGS_TABLES = [
  payItems,
  formulas,
  payRules,
  accountTypes,
  banks,
  taxStructures,
  taxRebates,
  benefits,
  incentives,
  payrollSettingsStore,
]

/** The stored general settings (the API's defaults until saved). */
export function currentPayrollSettings(): PayrollSettings {
  const { id: _id, ...settings } = payrollSettingsStore.find('settings') ?? {
    id: 'settings',
    ...defaultPayrollSettings(),
  }
  return settings
}
