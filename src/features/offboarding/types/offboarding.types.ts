import type { FileRef } from '@/lib/files'

/*
 * Shapes of the backend's /api/offboarding routes (backend/app/schemas/offboarding.py),
 * camelCase, ids as strings. Edits and deletes send the `rowVersion` last read.
 */

// --- Settings → Off Boarding Checklist -------------------------------------------------------

export const CHECKLIST_FIELD_TYPES = ['number', 'string', 'date', 'boolean'] as const
export type ChecklistFieldType = (typeof CHECKLIST_FIELD_TYPES)[number]

/**
 * One "Additional Information" field: a value range for a Number, a length
 * range for a String; Date and Boolean have none.
 */
export interface ChecklistField {
  id: string
  name: string
  fieldType: ChecklistFieldType
  isRequired: boolean
  minValue: number | null
  maxValue: number | null
  minLength: number | null
  maxLength: number | null
  sortOrder: number | null
}

export interface ChecklistFieldInput {
  /** Kept on an edited field, so its answers stay with it. */
  id?: string | undefined
  name: string
  fieldType: ChecklistFieldType
  isRequired: boolean
  minValue: number | null
  maxValue: number | null
  minLength: number | null
  maxLength: number | null
}

export interface OffboardingChecklist {
  id: string
  /** `ECL-00001`. */
  code: string
  name: string
  description: string | null
  isActive: boolean
  fieldCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  /** Filled on a single checklist; empty in lists. */
  fields: ChecklistField[]
}

export interface ChecklistInput {
  name: string
  description: string | null
  isActive: boolean
  fields: ChecklistFieldInput[]
  rowVersion?: string | undefined
}

/** A field of an active checklist, as the End of Employment Checklist tab asks it. */
export interface ActiveChecklistField extends ChecklistField {
  offboardingChecklistId: string
  checklistName: string
}

// --- End of Employment -----------------------------------------------------------------------

export const EOE_REASONS = ['resignation', 'termination', 'retirement', 'other'] as const
export type EoeReason = (typeof EOE_REASONS)[number]

export const EOE_STATUSES = ['pending', 'completed'] as const
export type EoeStatus = (typeof EOE_STATUSES)[number]

/** The sidebar's All / Completed / Pending. */
export const EOE_SCOPES = ['all', 'completed', 'pending'] as const
export type EoeScope = (typeof EOE_SCOPES)[number]

export interface EndOfEmploymentRow {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  branchName: string | null
  locationName: string | null
  departmentName: string | null
  designationName: string | null
  reason: EoeReason
  /** The Notice Period tick. */
  serveNotice: boolean
  /** Without a notice period, the day the record was made. */
  lastWorkingDate: string
  status: EoeStatus
  completedAt: string | null
  isRehired: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface ChecklistAnswer {
  checklistFieldId: string
  fieldName: string
  fieldType: ChecklistFieldType
  checklistId: string
  checklistName: string
  /** Text: numbers as digits, dates as yyyy-mm-dd, booleans as true / false. */
  answer: string | null
}

/** What keeps a pending record from completing. */
export interface WaitingItem {
  /** final_settlement, asset_clearance, assets, checklist, last_working_date */
  item: string
  label: string
}

export interface EndOfEmployment extends EndOfEmploymentRow {
  employeeEmail: string | null
  employeePhone: string | null
  dateOfBirth: string | null
  photoFileId: string | null
  /** Signed link to the employee's photo (expires). */
  photoUrl: string | null
  joiningDate: string | null
  resignationRequestId: string | null
  noticePeriodDays: number | null
  needsFinalSettlement: boolean
  needsAssetClearance: boolean
  assetClearByDate: string | null
  replacementId: string | null
  replacementName: string | null
  delegateeId: string | null
  delegateeName: string | null
  description: string | null
  fileId: string | null
  file: FileRef | null
  finalSettlementId: string | null
  /** pending / closed (Payroll closes it). */
  finalSettlementStatus: string | null
  clearanceId: string | null
  /** in_progress / approved. */
  clearanceStatus: string | null
  rehireJoiningDate: string | null
  answers: ChecklistAnswer[]
  waitingFor: WaitingItem[]
}

export interface EndOfEmploymentInput {
  employeeId: string
  reason: EoeReason
  serveNotice: boolean
  noticePeriodDays: number | null
  lastWorkingDate: string | null
  needsFinalSettlement: boolean
  needsAssetClearance: boolean
  assetClearByDate: string | null
  replacementId: string | null
  delegateeId: string | null
  description: string | null
  fileId: string | null
  rowVersion?: string | undefined
}

export type ChecklistAnswerValue = string | number | boolean | null

export interface ChecklistAnswersInput {
  answers: { checklistFieldId: string; answer: ChecklistAnswerValue }[]
  rowVersion: string
}

/** The card at the top of the End of Employment dialogs. */
export interface EmployeeCardInfo {
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
