import type {
  ContractStatus,
  ContractType,
  DependentRelation,
  DocumentType,
  EmergencyRelation,
  EmployeeStatus,
  Gender,
  MaritalStatus,
  ProfileTab,
  SalaryFrequency,
  SkillLevel,
} from './types/employees.types'

/**
 * Permission codes. The API spec names none for `/employees…`; these follow the codes other
 * modules already use for employees (`employees.directory.view` for pickers,
 * `employees.update_requests.create` for Benefits' Update Information) and are assumptions until
 * the catalogue confirms them. In mock mode (no permissions list) everything shows.
 */
export const TM_CODES = {
  view: 'employees.directory.view',
  create: 'employees.directory.create',
  edit: 'employees.directory.edit',
  deactivate: 'employees.directory.deactivate',
  identity: 'employees.identity.edit',
  /** The child tables (dependents, skills, education, …) and the photo. */
  records: 'employees.directory.edit',
} as const

/** Rows per page of the Employees table, and its choices. */
export const EMPLOYEE_PAGE_SIZE = 10
export const EMPLOYEE_PAGE_SIZES = [10, 20, 50] as const

export interface ChipMeta {
  label: string
  className: string
}

/** Status chips: the Leaves palette (Approved green, Pending amber, Rejected red, Cancelled violet). */
export const EMPLOYEE_STATUS_META: Record<EmployeeStatus, ChipMeta> = {
  active: {
    label: 'Active',
    className: 'bg-[#2CBD4D]/[0.18] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400',
  },
  probation: {
    label: 'On Probation',
    className: 'bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300',
  },
  notice: {
    label: 'On Notice',
    className: 'bg-[#FFEDE0] text-[#C2560C] dark:bg-orange-500/15 dark:text-orange-300',
  },
  left: {
    label: 'Left',
    className: 'bg-[#EFEFEF] text-[#5C5C5C] dark:bg-muted dark:text-muted-foreground',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300',
  },
}

/** A status the API sent that the screens do not know shows as it came. */
export function statusMeta(status: string): ChipMeta {
  return (
    (EMPLOYEE_STATUS_META as Partial<Record<string, ChipMeta>>)[status] ?? {
      label: status,
      className: EMPLOYEE_STATUS_META.left.className,
    }
  )
}

/** Active and probation people count as working; the rest can be reactivated. */
export const isInactiveStatus = (status: string) => status === 'inactive' || status === 'left'

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
}

export const MARITAL_LABELS: Record<MaritalStatus, string> = {
  single: 'Single',
  married: 'Married',
  divorced: 'Divorced',
  widowed: 'Widowed',
}

export const SALARY_FREQUENCY_LABELS: Record<SalaryFrequency, string> = {
  monthly: 'Monthly',
  daily: 'Daily',
  hourly: 'Hourly',
}

export const DEPENDENT_RELATION_LABELS: Record<DependentRelation, string> = {
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  father: 'Father',
  mother: 'Mother',
  brother: 'Brother',
  sister: 'Sister',
  other: 'Other',
}

/** "Male Dependents" / "Female Dependents": the relations each side of the toggle offers. */
export const DEPENDENT_SIDES = {
  male: ['father', 'brother', 'son', 'spouse', 'other'],
  female: ['mother', 'sister', 'daughter', 'spouse', 'other'],
} as const satisfies Record<'male' | 'female', readonly DependentRelation[]>
export type DependentSide = keyof typeof DEPENDENT_SIDES

export const EMERGENCY_RELATION_LABELS: Record<EmergencyRelation, string> = {
  spouse: 'Spouse',
  father: 'Father',
  mother: 'Mother',
  brother: 'Brother',
  sister: 'Sister',
  son: 'Son',
  daughter: 'Daughter',
  friend: 'Friend',
  relative: 'Relative',
  other: 'Other',
}

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  permanent: 'Permanent',
  temporary: 'Temporary',
  contractual: 'Contractual',
  probation: 'Probation',
  internship: 'Internship',
  consultant: 'Consultant',
}

export const CONTRACT_STATUS_META: Record<ContractStatus, ChipMeta> = {
  upcoming: {
    label: 'Upcoming',
    className: 'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
  },
  active: EMPLOYEE_STATUS_META.active,
  expired: EMPLOYEE_STATUS_META.left,
}

/** "Contract Duration in Months": the usual terms, or Custom (pick the To Date). */
export const CONTRACT_DURATIONS = [3, 6, 12, 24, 36] as const

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cnic: 'CNIC',
  passport: 'Passport',
  driving_licence: 'Driving Licence',
  offer_letter: 'Offer Letter',
  promotion_letter: 'Promotion Letter',
  appraisal_letter: 'Appraisal Letter',
  salary_certificate: 'Salary Certificate',
  experience_letter: 'Experience Letter',
  degree: 'Degree',
  certificate: 'Certificate / Resume',
  medical: 'Medical',
  other: 'Other',
}

export const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  personal: 'Personal',
  work: 'Work',
  documents: 'Documents',
  dependents: 'Dependents',
  benefits: 'Benefits',
  leave: 'Leave',
  skills: 'Skills',
}

/** Uploads: the server takes these types (checked again there). */
export const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp'
export const PHOTO_ACCEPT = '.png,.jpg,.jpeg,.webp'

/** Labels that look up a value in a record of labels, falling back to the value itself. */
export function labelOf<T extends string>(labels: Record<T, string>, value: string | null): string {
  if (!value) return ''
  return (labels as Partial<Record<string, string>>)[value] ?? value
}
