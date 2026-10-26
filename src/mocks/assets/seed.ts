import { format, subDays } from 'date-fns'

import type { AssetCondition, AssetHistoryRow, AssetStatus } from '@/features/assets'

import { findEmployee } from '../employees/seed'
import type { StoredAllocation, StoredAsset, StoredAssetType, StoredClearance } from './db'

/** How audit rows name a holder: "Name - CODE" (the seed uses the directory id as the code). */
const holderText = (id: string) => `${findEmployee(id)?.name ?? id} - ${id}`
const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
const stamp = (back: number, time = '10:30') => `${day(back)}T${time}:00.000Z`
const version = (id: string) => `seed${id.replace(/\W/g, '')}`.padEnd(16, '0').slice(0, 16)

/** Who did it, as Asset History names them (a user, not an employee). */
const HR_USER = { performedByUserId: '1', performedByName: 'Shelley Kannes' }

export function seedAssetTypes(): StoredAssetType[] {
  const type = (
    id: string,
    index: number,
    name: string,
    description: string | null,
    isActive = true,
  ): StoredAssetType => ({
    id,
    code: `AITP-${String(index).padStart(5, '0')}`,
    name,
    description,
    isActive,
    createdAt: stamp(600 - index * 10),
    updatedAt: null,
    rowVersion: version(id),
  })
  return [
    type('at_laptop', 1, 'Laptop', 'Laptops and notebooks.'),
    type('at_car', 2, 'Car', 'Company cars.'),
    type('at_mobile', 3, 'Mobile Phone', 'Phones on the company plan.'),
    type('at_storage', 4, 'Hard Drive', 'External drives.'),
    type('at_monitor', 5, 'Monitor', null),
    type('at_printer', 6, 'Printer', 'No longer issued.', false),
  ]
}

interface AssetSeed {
  id: string
  name: string
  assetTypeId: string
  identificationNo: string
  manufacturer: string
  model: string
  currentValue: number
  acquired: number
  condition?: AssetCondition
  status?: AssetStatus
}

const ASSETS: AssetSeed[] = [
  {
    id: 'as_1',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNo: '123456789',
    manufacturer: 'Dell',
    model: 'TM-4356',
    currentValue: 100_000,
    acquired: 405,
  },
  {
    id: 'as_2',
    name: 'Hard Drive',
    assetTypeId: 'at_storage',
    identificationNo: 'SG-2TB-7781',
    manufacturer: 'Seagate',
    model: 'Expansion 2TB',
    currentValue: 18_000,
    acquired: 380,
  },
  {
    id: 'as_3',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNo: 'HP-840-55120',
    manufacturer: 'HP',
    model: 'EliteBook 840',
    currentValue: 145_000,
    acquired: 520,
    condition: 'old',
  },
  {
    id: 'as_4',
    name: 'Car',
    assetTypeId: 'at_car',
    identificationNo: 'LEB-21-4410',
    manufacturer: 'Toyota',
    model: 'Corolla Altis',
    currentValue: 5_800_000,
    acquired: 300,
  },
  {
    id: 'as_5',
    name: 'Mobile Phone',
    assetTypeId: 'at_mobile',
    identificationNo: '356789104455120',
    manufacturer: 'Samsung',
    model: 'Galaxy A54',
    currentValue: 95_000,
    acquired: 260,
  },
  {
    id: 'as_6',
    name: 'Monitor',
    assetTypeId: 'at_monitor',
    identificationNo: 'LG-27-90031',
    manufacturer: 'LG',
    model: '27UL500',
    currentValue: 65_000,
    acquired: 700,
    condition: 'old',
    status: 'decommissioned',
  },
  {
    id: 'as_7',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNo: 'LN-E14-33017',
    manufacturer: 'Lenovo',
    model: 'ThinkPad E14',
    currentValue: 150_000,
    acquired: 560,
    condition: 'fair',
  },
  {
    id: 'as_8',
    name: 'Mobile Phone',
    assetTypeId: 'at_mobile',
    identificationNo: '353211087761204',
    manufacturer: 'Apple',
    model: 'iPhone 13',
    currentValue: 180_000,
    acquired: 130,
  },
  {
    id: 'as_9',
    name: 'Monitor',
    assetTypeId: 'at_monitor',
    identificationNo: 'DL-P24-11908',
    manufacturer: 'Dell',
    model: 'P2422H',
    currentValue: 55_000,
    acquired: 90,
  },
]

/** [id, person, asset, allocated days ago, deallocated days ago, clearance that closed it]. */
const ALLOCATIONS: [string, string, string, number, number | null, string | null][] = [
  ['al_1', 'em_hina', 'as_1', 300, null, null],
  ['al_2', 'em_ayesha', 'as_4', 200, null, null],
  ['al_3', 'em_talha', 'as_3', 380, null, null],
  ['al_4', 'em_talha', 'as_5', 250, null, null],
  // Nida Hassan returned hers at her clearance (approved), on her last working day.
  ['al_5', 'em_nida', 'as_7', 500, 50, 'cf_1'],
  ['al_6', 'em_shelley', 'as_8', 120, null, null],
]

export function seedAllocations(): StoredAllocation[] {
  return ALLOCATIONS.map(([id, employeeId, assetId, from, to, clearance]) => ({
    id,
    employeeId,
    assetId,
    allocatedOn: day(from),
    deallocatedOn: to === null ? null : day(to),
    description: null,
    returnCondition: to === null ? null : 'good',
    deallocationRemarks: null,
    fileId: null,
    fileName: null,
    assetClearanceId: clearance,
    createdAt: stamp(from),
    updatedAt: to === null ? null : stamp(to),
    rowVersion: version(id),
  }))
}

export function seedAssets(): StoredAsset[] {
  return ASSETS.map((seed) => {
    const status = seed.status ?? 'active'
    const history: AssetHistoryRow[] = [
      {
        id: `ah_${seed.id}_create`,
        action: 'create',
        fieldName: null,
        oldValue: null,
        newValue: null,
        performedAt: stamp(seed.acquired, '09:15'),
        ...HR_USER,
      },
    ]
    for (const [id, employeeId, assetId, from, to] of ALLOCATIONS) {
      if (assetId !== seed.id) continue
      history.push({
        id: `ah_${id}_allocate`,
        action: 'allocate',
        fieldName: 'holder',
        oldValue: null,
        newValue: holderText(employeeId),
        performedAt: stamp(from, '11:00'),
        ...HR_USER,
      })
      if (to !== null) {
        history.push({
          id: `ah_${id}_clearance`,
          action: 'clearance',
          fieldName: 'holder',
          oldValue: holderText(employeeId),
          newValue: 'complete',
          performedAt: stamp(to - 1, '15:40'),
          ...HR_USER,
        })
      }
    }
    if (status !== 'active') {
      history.push({
        id: `ah_${seed.id}_deactivate`,
        action: 'deactivate',
        fieldName: 'status',
        oldValue: 'active',
        newValue: status,
        performedAt: stamp(40, '12:05'),
        ...HR_USER,
      })
    }
    return {
      id: seed.id,
      code: `AST-${seed.id.replace('as_', '').padStart(5, '0')}`,
      name: seed.name,
      assetTypeId: seed.assetTypeId,
      identificationNo: seed.identificationNo,
      isTaxable: true,
      assetCondition: seed.condition ?? 'new',
      manufacturer: seed.manufacturer,
      model: seed.model,
      currentValue: seed.currentValue,
      acquiredDate: day(seed.acquired),
      description: null,
      fileId: null,
      fileName: null,
      status,
      createdAt: stamp(seed.acquired, '09:15'),
      updatedAt: null,
      rowVersion: version(seed.id),
      history: history.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    }
  })
}

/**
 * The two leavers Payroll's Final Settlement already has: Nida Hassan's form
 * approved on her last day, Talha Aziz's in progress with HR (laptop and phone).
 */
export function seedClearances(): StoredClearance[] {
  return [
    {
      id: 'cf_1',
      employeeId: 'em_nida',
      endOfEmploymentId: 'eoe_2',
      clearanceDate: day(50),
      checkedById: 'em_hina',
      approvedById: 'em_shelley',
      approvalDate: day(49),
      fileId: null,
      fileName: null,
      status: 'approved',
      items: [
        {
          id: 'cl_1',
          assetAllocationId: 'al_5',
          conditionAtClearance: 'good',
          reason: 'Resignation',
          returnStatus: 'complete',
          comments: null,
        },
      ],
      createdAt: stamp(52),
      updatedAt: stamp(49),
      rowVersion: version('cf_1'),
      statusChanges: [],
    },
    {
      id: 'cf_2',
      employeeId: 'em_talha',
      endOfEmploymentId: 'eoe_1',
      clearanceDate: day(15),
      checkedById: 'em_hina',
      approvedById: 'em_shelley',
      approvalDate: day(14),
      fileId: null,
      fileName: null,
      status: 'in_progress',
      items: [
        {
          id: 'cl_2',
          assetAllocationId: 'al_3',
          conditionAtClearance: 'good',
          reason: 'Resignation',
          returnStatus: 'complete',
          comments: null,
        },
        {
          id: 'cl_3',
          assetAllocationId: 'al_4',
          conditionAtClearance: 'fair',
          reason: 'Resignation',
          returnStatus: 'partial',
          comments: 'Charger not returned.',
        },
      ],
      createdAt: stamp(16),
      updatedAt: null,
      rowVersion: version('cf_2'),
      statusChanges: [],
    },
  ]
}
