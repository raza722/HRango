import type {
  ElectionStatus,
  ElectionUnit,
  NewHireStart,
  PlanCategory,
  PlanYearStatus,
  WindowStatus,
} from './types/benefits.types'

export interface CategoryMeta {
  value: PlanCategory
  /** The Add New Plan menu item and the Plans table's Category. */
  label: string
  /** The coverage group in the plan pickers ("Medical Coverage"). */
  coverage: string
  /** The form title: "Add {title} Plan". */
  title: string
  /** Plan Type options. */
  planTypes: readonly string[]
}

/** The Add New Plan menu, in its order. */
export const PLAN_CATEGORIES: readonly CategoryMeta[] = [
  {
    value: 'medical',
    label: 'Medical',
    coverage: 'Medical Coverage',
    title: 'Medical',
    planTypes: ['EPO', 'HMO', 'PPO', 'POS', 'HDHP'],
  },
  {
    value: 'dental',
    label: 'Dental',
    coverage: 'Dental Coverage',
    title: 'Dental',
    planTypes: ['DHMO', 'DPPO', 'Indemnity'],
  },
  {
    value: 'vision',
    label: 'Vision',
    coverage: 'Vision',
    title: 'Vision',
    planTypes: ['Vision HMO', 'Vision PPO'],
  },
  {
    value: 'retirement',
    label: 'Retirement',
    coverage: 'Retirement',
    title: 'Retirement',
    planTypes: ['401(k)', 'Roth 401(k)', 'Pension'],
  },
  {
    value: 'hsa',
    label: 'Health Savings Account',
    coverage: 'Health Savings Account',
    title: 'Health Savings Account',
    planTypes: ['Individual HSA', 'Family HSA'],
  },
  {
    value: 'life',
    label: 'Life Insurance',
    coverage: 'Life Coverage',
    title: 'Life Insurance',
    planTypes: ['Basic Life', 'Supplemental Life', 'AD&D'],
  },
  {
    value: 'others',
    label: 'Others',
    coverage: 'Others',
    title: 'Other',
    planTypes: ['Other'],
  },
]

export function categoryMeta(value: PlanCategory): CategoryMeta {
  const found = PLAN_CATEGORIES.find((category) => category.value === value)
  if (!found) throw new Error(`Unknown plan category: ${value}`)
  return found
}

/**
 * Order of the coverage groups in the plan pickers: the open enrollment frame draws
 * Medical, Life, Dental, Vision in a two-column grid.
 */
export const COVERAGE_ORDER: readonly PlanCategory[] = [
  'medical',
  'life',
  'dental',
  'vision',
  'retirement',
  'hsa',
  'others',
]

/** Carrier options of the Add Plan form. */
export const CARRIERS = [
  'Aetna',
  'Blue Cross Blue Shield',
  'Cigna',
  'Delta Dental',
  'Guardian',
  'Humana',
  'Kaiser Permanente',
  'MetLife',
  'UnitedHealthcare',
  'VSP Vision Care',
] as const

export const NEW_HIRE_OPTIONS: readonly { value: NewHireStart; label: string }[] = [
  { value: 'immediately', label: 'Immediately upon hire' },
  { value: 'waiting-period', label: 'After a waiting period' },
  { value: 'per-employee', label: 'It will be different per employee' },
]
export const NEW_HIRE_VALUES = NEW_HIRE_OPTIONS.map((option) => option.value) as [
  NewHireStart,
  ...NewHireStart[],
]

export const ELECTION_UNITS: readonly ElectionUnit[] = ['day', 'week', 'month']

/** "1 month", "2 months". */
export function unitLabel(unit: ElectionUnit, count: number): string {
  return count === 1 ? unit : `${unit}s`
}

export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'] as const

/** The benefit details each person needs, with their labels. */
export const PROFILE_FIELDS = [
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'maritalStatus', label: 'Marital Status' },
  { key: 'homeAddress', label: 'Home Address' },
] as const

/** Plan attachments: up to 5 MB of PDF, Word or images. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg'

export interface ChipMeta {
  label: string
  className: string
}

/** Active is drawn (#DCF4ED / #1BC65F); Upcoming and Ended follow it. */
export const PLAN_YEAR_STATUS: Record<PlanYearStatus, ChipMeta> = {
  active: {
    label: 'Active',
    className: 'bg-[#DCF4ED] text-[#1BC65F] dark:bg-[#1BC65F]/15 dark:text-[#4ADE80]',
  },
  upcoming: {
    label: 'Upcoming',
    className: 'bg-[#EBEFF8] text-[#7469E8] dark:bg-[#7469E8]/20 dark:text-[#A39BFF]',
  },
  ended: {
    label: 'Ended',
    className: 'bg-[#EFEFEF] text-[#707070] dark:bg-muted dark:text-muted-foreground',
  },
}

export const WINDOW_STATUS: Record<WindowStatus, ChipMeta> = {
  open: { label: 'Open', className: PLAN_YEAR_STATUS.active.className },
  closed: { label: 'Closed', className: PLAN_YEAR_STATUS.ended.className },
}

export const ELECTION_STATUS: Record<ElectionStatus | 'none', ChipMeta> = {
  approved: { label: 'Approved', className: PLAN_YEAR_STATUS.active.className },
  pending: {
    label: 'Pending',
    className: 'bg-[#FFF3E3] text-[#D97706] dark:bg-[#FD9317]/15 dark:text-[#FDBA74]',
  },
  incomplete: {
    label: 'Incomplete',
    className: 'bg-[#FBE9E2] text-[#C2420B] dark:bg-[#C2420B]/20 dark:text-[#FCA5A5]',
  },
  waived: { label: 'Waived', className: PLAN_YEAR_STATUS.ended.className },
  none: { label: 'Not started', className: PLAN_YEAR_STATUS.ended.className },
}
