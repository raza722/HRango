import type { BudgetStatus, OpenPositionStatus, PlanMode, PlanStatus } from './types/manpower.types'

/** Chip colours: the designs' green (#24B13B at 10%), plus amber and red for the other states. */
export const CHIP_TONE = {
  green: 'text-[#24B13B] before:bg-[#24B13B]',
  amber: 'text-[#C27C0E] before:bg-[#F2A516]',
  red: 'text-[#D33300] before:bg-[#D33300]',
  grey: 'text-[#707070] before:bg-[#707070]',
} as const
export type ChipTone = keyof typeof CHIP_TONE

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  approved: { label: 'Approved', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'red' },
}

export const BUDGET_STATUS_META: Record<BudgetStatus, { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'red' },
}

export const OPEN_POSITION_STATUS_META: Record<
  OpenPositionStatus,
  { label: string; tone: ChipTone }
> = {
  active: { label: 'Active', tone: 'green' },
  closed: { label: 'Closed', tone: 'grey' },
}

export const ACTIVE_META = {
  true: { label: 'Active', tone: 'green' },
  false: { label: 'Inactive', tone: 'grey' },
} as const satisfies Record<'true' | 'false', { label: string; tone: ChipTone }>

export const PLAN_MODE_LABELS: Record<PlanMode, string> = {
  new: 'New',
  existing: 'Existing',
}

/** "Show: 10 entries". */
export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10

/** E-Budget Settings tabs, as drawn. */
export const SETTINGS_TABS = [
  { value: 'budget-duration', label: 'Budget Duration' },
  { value: 'position-title', label: 'Position Title' },
  { value: 'employee-position', label: 'Employee Position' },
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]['value']

/** Division and Station start at "ALL", as Add Planning draws them. */
export const ALL_VALUE = 'all'
