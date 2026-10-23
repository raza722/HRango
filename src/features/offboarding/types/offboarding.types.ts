import type { EmployeeRef } from '@/features/payroll'

export type { EmployeeRef }

// --- Settings → Off Boarding Checklist -------------------------------------------------------

export const CHECKLIST_FIELD_TYPES = ['number', 'string', 'date', 'boolean'] as const
export type ChecklistFieldType = (typeof CHECKLIST_FIELD_TYPES)[number]

/**
 * One "Additional Information" field. `min` / `max` are the value range for a
 * Number and the length range for a String; Date and Boolean have none.
 */
export interface ChecklistField {
  id: string
  name: string
  type: ChecklistFieldType
  required: boolean
  min: number | null
  max: number | null
}
export type ChecklistFieldInput = Omit<ChecklistField, 'id'> & { id?: string | undefined }

export interface OffboardingChecklist {
  id: string
  /** `ECL-00001`. */
  code: string
  name: string
  active: boolean
  description: string
  fields: ChecklistField[]
  createdAt: string
}
export interface ChecklistInput {
  name: string
  active: boolean
  description: string
  fields: ChecklistFieldInput[]
}

// --- End of Employment -----------------------------------------------------------------------

export const EOE_REASONS = [
  'termination',
  'resignation',
  'retirement',
  'transfer',
  'other',
] as const
export type EoeReason = (typeof EOE_REASONS)[number]

export const EOE_STATUSES = ['pending', 'completed'] as const
export type EoeStatus = (typeof EOE_STATUSES)[number]

/** The sidebar's All / Completed / Pending. */
export const EOE_SCOPES = ['all', 'completed', 'pending'] as const
export type EoeScope = (typeof EOE_SCOPES)[number]

export type ChecklistValue = string | number | boolean | null

export interface EndOfEmployment {
  id: string
  employeeId: string
  reason: EoeReason
  noticePeriod: boolean
  /** Set with a notice period; without one the person leaves on the day it is made. */
  lastWorkingDate: string | null
  finalSettlement: boolean
  assetClearance: boolean
  attachmentName: string | null
  description: string
  delegateeId: string | null
  /** Checklist tab answers, by field id. */
  checklist: Record<string, ChecklistValue>
  status: EoeStatus
  createdAt: string
  completedAt: string | null
  /** The Payroll Final Settlement it made (Final Settlement ticked). */
  finalSettlementId: string | null
  /** The Asset Clearance Form for it (Asset Clearance ticked). */
  clearanceId: string | null
  rehire: { joiningDate: string; at: string } | null
}

export interface EndOfEmploymentInput {
  employeeId: string
  reason: EoeReason
  noticePeriod: boolean
  lastWorkingDate: string | null
  finalSettlement: boolean
  assetClearance: boolean
  attachmentName: string | null
  description: string
  delegateeId: string | null
  checklist: Record<string, ChecklistValue>
}

export interface EndOfEmploymentRow {
  id: string
  employee: EmployeeRef
  branch: string | null
  location: string | null
  department: string
  designation: string
  /** The last working date (the day it was made, without a notice period). */
  date: string
  createdAt: string
  completedAt: string | null
  status: EoeStatus
  rehired: boolean
}

/** The card at the top of the End of Employment dialogs. */
export interface EmployeeCardInfo {
  id: string
  name: string
  designation: string
  code: string
  photoUrl: string | null
  /** "28 years, 11 Months, 2 Days". */
  age: string
  email: string
  phone: string
  /** "4 Year 9 Month 25 Days". */
  experience: string
}

export interface EndOfEmploymentDetail extends EndOfEmployment {
  card: EmployeeCardInfo
  delegatee: EmployeeRef | null
  /** What still keeps it pending (empty once completed). */
  waitingFor: string[]
  finalSettlementStatus: 'pending' | 'completed' | null
  clearanceStatus: 'pending' | 'approved' | null
}

export interface EoeImportRow {
  employeeCode: string
  reason: string
  lastWorkingDate: string
  noticePeriod: boolean
  finalSettlement: boolean
  assetClearance: boolean
}

// --- Lookups ---------------------------------------------------------------------------------

export interface OffboardingLookups {
  employees: (EmployeeRef & {
    status: 'active' | 'inactive'
    branchId: string | null
    locationId: string | null
  })[]
  departments: string[]
  designations: string[]
  branches: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  /** Fields of the active checklists, for the Checklist tab. */
  checklistFields: (ChecklistField & { checklist: string })[]
}

export interface ListParams {
  page: number
  pageSize: number
}
