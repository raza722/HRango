import type {
  AssetCondition,
  AssetHistoryRow,
  AssetStatus,
  ClearanceStatus,
  ReturnCondition,
  ReturnStatus,
} from '@/features/assets'

import { createMockCollection } from '../collection'
import { seedAllocations, seedAssets, seedAssetTypes, seedClearances } from './seed'

/*
 * The mock's tables, close to the backend's (sep.asset_type, sep.asset, sep.asset_allocation,
 * sep.asset_clearance + items). Names and computed columns are worked out in the handlers.
 */

export interface StoredAssetType {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface StoredAsset {
  id: string
  code: string
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
  /** The mock cannot read an upload's name back, so a seeded file keeps one here. */
  fileName: string | null
  status: AssetStatus
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  /** core.audit_log rows for the asset, newest first. */
  history: AssetHistoryRow[]
}

export interface StoredAllocation {
  id: string
  employeeId: string
  assetId: string
  allocatedOn: string
  deallocatedOn: string | null
  description: string | null
  returnCondition: ReturnCondition | null
  deallocationRemarks: string | null
  fileId: string | null
  fileName: string | null
  /** The clearance form that closed it (Unapprove reopens exactly these). */
  assetClearanceId: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface StoredClearanceItem {
  id: string
  assetAllocationId: string
  conditionAtClearance: ReturnCondition
  reason: string | null
  returnStatus: ReturnStatus
  comments: string | null
}

export interface StoredClearance {
  id: string
  employeeId: string
  endOfEmploymentId: string | null
  clearanceDate: string
  checkedById: string | null
  approvedById: string | null
  approvalDate: string | null
  fileId: string | null
  fileName: string | null
  status: ClearanceStatus
  items: StoredClearanceItem[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  /** What approval changed to asset statuses, so Unapprove can put them back. */
  statusChanges: { assetId: string; from: AssetStatus }[]
}

const key = (name: string) => `hrms-mock-assets-v2-${name}`

export const assetTypes = createMockCollection<StoredAssetType>({
  storageKey: key('types'),
  seed: seedAssetTypes,
})
export const assets = createMockCollection<StoredAsset>({
  storageKey: key('items'),
  seed: seedAssets,
})
export const allocations = createMockCollection<StoredAllocation>({
  storageKey: key('allocations'),
  seed: seedAllocations,
})
export const clearances = createMockCollection<StoredClearance>({
  storageKey: key('clearances'),
  seed: seedClearances,
})

export function resetAssetsDb(): void {
  for (const collection of [assetTypes, assets, allocations, clearances]) collection.reset()
}

/** The open allocation of an asset, if someone holds it. */
export const openAllocationOf = (assetId: string) =>
  allocations.all().find((item) => item.assetId === assetId && item.deallocatedOn === null)
