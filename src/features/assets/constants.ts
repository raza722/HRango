import type {
  AllocationStatus,
  AssetAvailability,
  AssetCondition,
  AssetStatus,
  ClearanceStatus,
  ReturnCondition,
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

/** Company Assets "Status" column: the server's availability (red "Unavailable", green "Allocated"). */
export const ASSET_AVAILABILITY_META: Record<AssetAvailability, ChipMeta> = {
  available: { label: 'Available', className: GREEN },
  allocated: { label: 'Allocated', className: GREEN },
  unavailable: { label: 'Unavailable', className: RED },
}

/** The asset record's own status. */
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Active',
  damaged: 'Damaged',
  lost: 'Lost',
  decommissioned: 'Decommissioned',
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
  in_progress: { label: 'In Progress', className: ORANGE },
  approved: { label: 'Approved', className: GREEN },
}

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  new: 'New',
  old: 'Old',
  fair: 'Fair',
}

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  good: 'Good',
  fair: 'Fair',
  damaged: 'Damaged',
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  complete: 'Complete Return',
  partial: 'Partial Return',
  not_returned: 'Not Returned',
}

/** Asset History: the server's column names as the popup shows them. */
export const ASSET_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  asset_type_id: 'Asset Type',
  identification_no: 'Identification Number',
  is_taxable: 'Is Taxable',
  asset_condition: 'Condition',
  manufacturer: 'Manufacturer',
  model: 'Model',
  file_id: 'Attachment',
  current_value: 'Current Value',
  acquired_date: 'Acquired Date',
  description: 'Description',
  status: 'Status',
  holder: 'Allocated To',
}

/** Asset History: the server's action names as the popup shows them. */
export const ASSET_ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  activate: 'Activate',
  deactivate: 'Deactivate',
  allocate: 'Allocate',
  deallocate: 'Deallocate',
  clearance: 'Clearance',
  'unapprove clearance': 'Unapprove Clearance',
  delete: 'Delete',
}

/** Rows per page on the Assets lists. */
export const ASSET_PAGE_SIZE = 10
