import type { Asset, AssetAllocation, AssetType, ClearanceForm } from '@/features/assets'

import { createMockCollection } from '../collection'
import { seedAllocations, seedAssets, seedAssetTypes, seedClearances } from './seed'

const key = (name: string) => `hrms-mock-assets-${name}`

export const assetTypes = createMockCollection<AssetType>({
  storageKey: key('types'),
  seed: seedAssetTypes,
})
export const assets = createMockCollection<Asset>({ storageKey: key('items'), seed: seedAssets })
export const allocations = createMockCollection<AssetAllocation>({
  storageKey: key('allocations'),
  seed: seedAllocations,
})
export const clearances = createMockCollection<ClearanceForm>({
  storageKey: key('clearances'),
  seed: seedClearances,
})

export function resetAssetsDb(): void {
  for (const collection of [assetTypes, assets, allocations, clearances]) collection.reset()
}

/** The person's open allocation of an asset, if it is allocated. */
export const openAllocationOf = (assetId: string) =>
  allocations.all().find((item) => item.assetId === assetId && item.deallocationDate === null)
