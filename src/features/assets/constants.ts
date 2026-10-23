import type {
  AllocationStatus,
  AssetCondition,
  AssetStatus,
  ClearanceCondition,
  ClearanceStatus,
  ReturnStatus,
} from './types/assets.types'

interface ChipMeta {
  label: string
  className: string
}

const GREEN = 'bg-[#E3F8E8] text-[#51B969]'
const RED = 'bg-[#FFE1E7] text-[#EF493E]'
const ORANGE = 'bg-[#FFF1DE] text-[#F08035]/90'
const GREY = 'bg-muted text-field-foreground'

/** Company Assets status (the frames draw red "Unavailable" and green "Allocated"). */
export const ASSET_STATUS_META: Record<AssetStatus, ChipMeta> = {
  available: { label: 'Available', className: GREEN },
  allocated: { label: 'Allocated', className: GREEN },
  unavailable: { label: 'Unavailable', className: RED },
}

export const ASSET_TYPE_STATUS_META: Record<'active' | 'inactive', ChipMeta> = {
  active: { label: 'Active', className: GREEN },
  inactive: { label: 'Inactive', className: GREY },
}

/** Asset Allocations, as drawn: a green "Allocated" chip. */
export const ALLOCATION_STATUS_META: Record<AllocationStatus, ChipMeta> = {
  allocated: { label: 'Allocated', className: GREEN },
  deallocated: { label: 'Deallocated', className: GREY },
}

export const CLEARANCE_STATUS_META: Record<ClearanceStatus, ChipMeta> = {
  pending: { label: 'Pending by HR', className: ORANGE },
  approved: { label: 'Approved', className: GREEN },
}

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  old: 'Old',
  new: 'New',
}

export const CLEARANCE_CONDITION_LABELS: Record<ClearanceCondition, string> = {
  good: 'Good',
  fair: 'Fair',
  damaged: 'Damaged',
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  complete: 'Complete Return',
  partial: 'Partial Return',
  'not-returned': 'Not Returned',
}

/** Field names as Asset History shows them. */
export const ASSET_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  assetTypeId: 'Asset Type',
  identificationNumber: 'Identification Number',
  taxable: 'Is Taxable',
  condition: 'Condition',
  manufacturer: 'Manufacturer',
  model: 'Model',
  attachmentName: 'Attachment',
  currentValue: 'Current Value',
  acquiredDate: 'Acquired Date',
  description: 'Description',
  active: 'Active',
  holder: 'Allocated To',
}

/** Rows per page on the Assets lists. */
export const ASSET_PAGE_SIZE = 10
