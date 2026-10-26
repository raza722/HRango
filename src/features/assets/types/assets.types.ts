import type { FileRef } from '@/lib/files'

/*
 * Shapes of the backend's /api/assets routes (backend/app/schemas/assets.py), camelCase, ids as
 * strings. Edits and deletes send the `rowVersion` last read.
 */

// --- Asset Types ---------------------------------------------------------------------------

export interface AssetType {
  id: string
  /** `AITP-00001`. */
  code: string
  name: string
  description: string | null
  isActive: boolean
  /** Assets of this type (a type in use cannot be deleted). */
  assetCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface AssetTypeInput {
  name: string
  description: string | null
  isActive: boolean
  rowVersion?: string | undefined
}

// --- Company Assets --------------------------------------------------------------------------

export const ASSET_CONDITIONS = ['old', 'new', 'fair'] as const
export type AssetCondition = (typeof ASSET_CONDITIONS)[number]

/** The record's status: Deactivate makes it decommissioned; a clearance can make it damaged or lost. */
export const ASSET_STATUSES = ['active', 'damaged', 'lost', 'decommissioned'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

/** Worked out by the server: allocated (someone holds it), available, or unavailable (not active). */
export const ASSET_AVAILABILITIES = ['available', 'allocated', 'unavailable'] as const
export type AssetAvailability = (typeof ASSET_AVAILABILITIES)[number]

export interface Asset {
  id: string
  /** `AST-00001`. */
  code: string
  name: string
  assetTypeId: string
  assetTypeName: string
  identificationNo: string | null
  isTaxable: boolean
  assetCondition: AssetCondition
  manufacturer: string | null
  model: string | null
  currentValue: number | null
  acquiredDate: string | null
  description: string | null
  fileId: string | null
  /** The attachment with a signed link (expires; open the record again for a fresh one). */
  file: FileRef | null
  status: AssetStatus
  availability: AssetAvailability
  holderId: string | null
  holderCode: string | null
  holderName: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface AssetInput {
  name: string
  assetTypeId: string
  identificationNo: string | null
  isTaxable: boolean
  assetCondition: AssetCondition
  manufacturer: string | null
  model: string | null
  currentValue: number | null
  acquiredDate: string | null
  description: string | null
  fileId: string | null
  rowVersion?: string | undefined
}

/**
 * One row of Asset History: one changed field, or an action without fields (create).
 * `action`: create, update, activate, deactivate, allocate, deallocate, clearance,
 * unapprove clearance. `fieldName` is the column (`identification_no`, `holder`, `status`, …).
 */
export interface AssetHistoryRow {
  id: string
  action: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  performedAt: string
  performedByUserId: string | null
  performedByName: string | null
}

// --- Asset Allocations -----------------------------------------------------------------------

export const ALLOCATION_STATUSES = ['allocated', 'deallocated'] as const
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number]

export const RETURN_CONDITIONS = ['good', 'fair', 'damaged'] as const
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number]

export interface Allocation {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  companyName: string
  assetId: string
  assetCode: string
  assetName: string
  identificationNo: string | null
  assetTypeId: string
  assetTypeName: string
  allocatedOn: string
  deallocatedOn: string | null
  status: AllocationStatus
  description: string | null
  returnCondition: ReturnCondition | null
  deallocationRemarks: string | null
  fileId: string | null
  file: FileRef | null
  /** The clearance form that closed it, if any. */
  assetClearanceId: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface AllocationInput {
  assetId: string
  employeeId: string
  allocatedOn: string
  description: string | null
  fileId: string | null
}

export interface DeallocateInput {
  deallocatedOn: string
  /** Damaged marks the asset damaged. */
  returnCondition: ReturnCondition | null
  remarks: string | null
  rowVersion: string
}

// --- Asset Clearance Form --------------------------------------------------------------------

export const RETURN_STATUSES = ['complete', 'partial', 'not_returned'] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

/** In progress until approved; Unapprove puts an approved form back. */
export const CLEARANCE_STATUSES = ['in_progress', 'approved'] as const
export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number]

export interface ClearanceRow {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  departmentId: string | null
  departmentName: string | null
  endOfEmploymentId: string | null
  clearanceDate: string
  approvalDate: string | null
  status: ClearanceStatus
  itemCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** One "Asset Details" block: an allocation the person holds, and how it came back. */
export interface ClearanceItem {
  id: string
  assetAllocationId: string
  assetId: string
  assetCode: string
  assetName: string
  identificationNo: string | null
  allocatedOn: string
  conditionAtClearance: ReturnCondition | null
  reason: string | null
  returnStatus: ReturnStatus | null
  comments: string | null
}

export interface Clearance extends ClearanceRow {
  checkedById: string | null
  checkedByName: string | null
  approvedById: string | null
  approvedByName: string | null
  fileId: string | null
  file: FileRef | null
  items: ClearanceItem[]
}

export interface ClearanceItemInput {
  assetAllocationId: string
  conditionAtClearance: ReturnCondition
  reason: string | null
  returnStatus: ReturnStatus
  comments: string | null
}

export interface ClearanceInput {
  employeeId: string
  endOfEmploymentId: string | null
  clearanceDate: string
  checkedById: string | null
  approvedById: string | null
  approvalDate: string | null
  fileId: string | null
  items: ClearanceItemInput[]
  rowVersion?: string | undefined
}

/** A form's row reference for bulk Approve / Unapprove. */
export interface ClearanceRef {
  id: string
  rowVersion: string
}

/** One open allocation of the leaver, for a new form's Asset Details. */
export interface ClearancePrefillItem {
  assetAllocationId: string
  assetId: string
  assetCode: string
  assetName: string
  identificationNo: string | null
  allocatedOn: string
}

/** What a new form starts with for a person (their open allocations, their pending end of employment). */
export interface ClearancePrefill {
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  departmentId: string | null
  departmentName: string | null
  endOfEmploymentId: string | null
  items: ClearancePrefillItem[]
}

// --- Pickers (shared with Off Boarding) ------------------------------------------------------

/** A `GET /employees/lookup` row: a person the caller reaches through a permission code. */
export interface EmployeeLookupItem {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string
  /** active, left, … */
  status: string
  photoUrl: string | null
}

/** `GET /organisation/lookups/{kind}`: ids and names for a picker. */
export interface OrgLookupItem {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

export type OrgLookupKind = 'departments' | 'designations' | 'branches' | 'locations'
