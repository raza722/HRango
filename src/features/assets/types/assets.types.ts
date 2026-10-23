import type { EmployeeRef } from '@/features/payroll'

export type { EmployeeRef }

// --- Asset Types ---------------------------------------------------------------------------

export interface AssetType {
  id: string
  /** `ATP-00001`. */
  code: string
  name: string
  description: string
  active: boolean
  createdAt: string
}
export type AssetTypeInput = Pick<AssetType, 'name' | 'description' | 'active'>

// --- Company Assets --------------------------------------------------------------------------

export const ASSET_CONDITIONS = ['old', 'new'] as const
export type AssetCondition = (typeof ASSET_CONDITIONS)[number]

/** Unavailable = deactivated (or lost / damaged at a clearance). */
export const ASSET_STATUSES = ['available', 'allocated', 'unavailable'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export interface AssetChange {
  field: string
  oldValue: string
  newValue: string
}

/** One line of "Asset History": who did what, and the fields it changed. */
export interface AssetHistoryEntry {
  id: string
  action: 'Create' | 'Update' | 'Allocate' | 'Deallocate' | 'Deactivate' | 'Activate' | 'Clearance'
  performedById: string
  performedAt: string
  changes: AssetChange[]
}

export interface Asset {
  id: string
  /** `AST-00001`. */
  code: string
  name: string
  assetTypeId: string
  identificationNumber: string
  taxable: boolean
  condition: AssetCondition
  manufacturer: string
  model: string
  attachmentName: string | null
  currentValue: number
  acquiredDate: string
  description: string
  /** Deactivate / Activate. */
  active: boolean
  createdAt: string
  history: AssetHistoryEntry[]
}

export type AssetInput = Pick<
  Asset,
  | 'name'
  | 'assetTypeId'
  | 'identificationNumber'
  | 'taxable'
  | 'condition'
  | 'manufacturer'
  | 'model'
  | 'attachmentName'
  | 'currentValue'
  | 'acquiredDate'
  | 'description'
>

export interface AssetRow {
  id: string
  code: string
  name: string
  identificationNumber: string
  assetTypeId: string
  assetType: string
  status: AssetStatus
  /** Who holds it now, when allocated. */
  holder: EmployeeRef | null
}

export interface AssetDetail extends Asset {
  assetType: string
  status: AssetStatus
  holder: EmployeeRef | null
}

export interface AssetHistoryRow extends Omit<AssetHistoryEntry, 'performedById'> {
  performedBy: EmployeeRef
}

export interface AssetImportRow {
  name: string
  assetType: string
  identificationNumber: string
  currentValue: number
  acquiredDate: string
  manufacturer: string
  model: string
}

// --- Asset Allocations -----------------------------------------------------------------------

export const ALLOCATION_STATUSES = ['allocated', 'deallocated'] as const
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number]

export interface AssetAllocation {
  id: string
  employeeId: string
  assetId: string
  allocationDate: string
  deallocationDate: string | null
  attachmentName: string | null
  description: string
  createdAt: string
}
export type AllocationInput = Pick<
  AssetAllocation,
  'employeeId' | 'assetId' | 'allocationDate' | 'attachmentName' | 'description'
>

export interface AllocationRow {
  id: string
  company: string
  employee: EmployeeRef
  assetId: string
  asset: string
  assetTypeId: string
  assetType: string
  identificationNumber: string
  allocationDate: string
  deallocationDate: string | null
  status: AllocationStatus
}
export interface AllocationDetail extends AllocationRow {
  attachmentName: string | null
  description: string
}

// --- Asset Clearance Form --------------------------------------------------------------------

export const CLEARANCE_CONDITIONS = ['good', 'fair', 'damaged'] as const
export type ClearanceCondition = (typeof CLEARANCE_CONDITIONS)[number]

export const RETURN_STATUSES = ['complete', 'partial', 'not-returned'] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

/** "Pending by HR" until approved; Unapproved puts an approved form back to pending. */
export const CLEARANCE_STATUSES = ['pending', 'approved'] as const
export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number]

/** One "Asset Details" block: an asset the person holds, and how it came back. */
export interface ClearanceLine {
  id: string
  assetId: string
  /** The allocation it clears (from the person's open allocations). */
  allocationId: string | null
  dateAllocated: string
  condition: ClearanceCondition
  reason: string
  returnStatus: ReturnStatus | null
  comments: string
}

export interface ClearanceForm {
  id: string
  employeeId: string
  clearanceDate: string
  lines: ClearanceLine[]
  checkedById: string
  approvedById: string
  approvalDate: string
  attachmentName: string | null
  status: ClearanceStatus
  /** Set when it was opened from an End of Employment record. */
  endOfEmploymentId: string | null
  createdAt: string
  /** What approval changed, so Unapproved can put it back. */
  effects: { deallocated: string[]; deactivated: string[] } | null
}

export type ClearanceLineInput = Omit<ClearanceLine, 'id'>
export interface ClearanceInput {
  employeeId: string
  clearanceDate: string
  lines: ClearanceLineInput[]
  checkedById: string
  approvedById: string
  approvalDate: string
  attachmentName: string | null
  endOfEmploymentId: string | null
}

export interface ClearanceRow {
  id: string
  employee: EmployeeRef
  clearanceDate: string
  status: ClearanceStatus
}

export interface ClearanceDetail extends ClearanceForm {
  employee: EmployeeRef
  lines: (ClearanceLine & { asset: string; identificationNumber: string })[]
}

/** What a new form starts with for a person: their open allocations as Asset Details. */
export interface ClearancePrefill {
  employee: EmployeeRef
  lines: ClearanceLineInput[]
}

// --- Lookups ---------------------------------------------------------------------------------

export interface AssetLookups {
  employees: (EmployeeRef & { status: 'active' | 'inactive' })[]
  departments: string[]
  assetTypes: { id: string; name: string; active: boolean }[]
  assets: {
    id: string
    name: string
    code: string
    identificationNumber: string
    assetTypeId: string
    status: AssetStatus
  }[]
}

export interface ListParams {
  page: number
  pageSize: number
}
