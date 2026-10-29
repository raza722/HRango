import { z } from 'zod'

/** Lists: the page in the URL; filters live in the Filters dialog (and its saved preset). */
export const pageSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
})
export type PageSearch = z.infer<typeof pageSearchSchema>
export const PAGE_SEARCH_DEFAULTS = { page: 1 } as const

/** Reports: the open tab (`?report=`) and its page. */
export const REPORT_TABS = ['accounts', 'employee-wise', 'daily-wages', 'summary'] as const
export const reportSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  report: z.enum(REPORT_TABS).default('accounts').catch('accounts'),
})
export type ReportSearch = z.infer<typeof reportSearchSchema>
export const REPORT_SEARCH_DEFAULTS = { page: 1, report: 'accounts' } as const

export const salarySheetSearchSchema = z.object({
  payrollId: z.string().optional().catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
})
export type SalarySheetSearch = z.infer<typeof salarySheetSearchSchema>

/** Payroll Settings tabs (a route each) and the sub-tabs inside them (`?view=`). */
export const SETTINGS_TABS = [
  'general',
  'tax',
  'rewards',
  'pay-components',
  'account-type',
  'disbursement-banks',
] as const
export type PayrollSettingsTab = (typeof SETTINGS_TABS)[number]

export const SETTINGS_VIEWS = {
  general: ['payroll-configuration', 'leave-configuration'],
  tax: ['tax-rebate', 'tax-structure'],
  rewards: ['benefits', 'incentives'],
  'pay-components': ['pay-items', 'formulas', 'rules'],
  'account-type': [],
  'disbursement-banks': [],
} as const satisfies Record<PayrollSettingsTab, readonly string[]>

export const settingsViewSchema = z.object({
  view: z.string().optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
})
export type SettingsViewSearch = z.infer<typeof settingsViewSchema>
