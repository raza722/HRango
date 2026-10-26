import type {
  ElectionStatus,
  ElectionUnit,
  MissingDetail,
  NewHireStart,
  PlanCategory,
  PlanYearStatus,
  WindowKind,
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
  { value: 'waiting_period', label: 'After a waiting period' },
  { value: 'per_employee', label: 'It will be different per employee' },
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

/** Marital statuses as the Employees module keeps them. */
export const MARITAL_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
] as const

/** The benefit details the API reports missing, with their labels. */
export const MISSING_LABELS: Record<MissingDetail, string> = {
  date_of_birth: 'Date of Birth',
  marital_status: 'Marital Status',
}

export const WINDOW_KIND_LABELS: Record<WindowKind, string> = {
  open_enrollment: 'Open Enrollment',
  life_event: 'Qualifying Life Event',
  new_hire: 'New Hire',
}

/** Permission codes (`app/catalogue/benefits.py`); buttons hide what the user lacks. */
export const BEN_CODES = {
  planYearCreate: 'benefits.plan_years.create',
  planYearEdit: 'benefits.plan_years.edit',
  planYearDelete: 'benefits.plan_years.delete',
  planCreate: 'benefits.plans.create',
  planDelete: 'benefits.plans.delete',
  windowCreate: 'benefits.enrollment_windows.create',
  windowDelete: 'benefits.enrollment_windows.delete',
  fileCreate: 'benefits.files.create',
  fileDelete: 'benefits.files.delete',
  fileDownload: 'benefits.files.download',
  profileUpdate: 'employees.update_requests.create',
} as const

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

export const PLAN_STATUS: Record<'active' | 'inactive', ChipMeta> = {
  active: { label: 'Active', className: PLAN_YEAR_STATUS.active.className },
  inactive: { label: 'Inactive', className: PLAN_YEAR_STATUS.ended.className },
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
  rejected: {
    label: 'Rejected',
    className: 'bg-[#FBE9E2] text-[#C2420B] dark:bg-[#C2420B]/20 dark:text-[#FCA5A5]',
  },
  none: { label: 'Not started', className: PLAN_YEAR_STATUS.ended.className },
}
