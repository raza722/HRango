import { format, subDays } from 'date-fns'

import type {
  Asset,
  AssetAllocation,
  AssetHistoryEntry,
  AssetType,
  ClearanceForm,
} from '@/features/assets'

import { findEmployee } from '../employees/seed'

const nameOf = (id: string) => findEmployee(id)?.name ?? id
const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
const stamp = (back: number, time = '10:30') => `${day(back)}T${time}:00.000Z`
const HR = 'em_shelley'

export function seedAssetTypes(): AssetType[] {
  const type = (
    id: string,
    index: number,
    name: string,
    description: string,
    active = true,
  ): AssetType => ({
    id,
    code: `ATP-${String(index).padStart(5, '0')}`,
    name,
    description,
    active,
    createdAt: stamp(600 - index * 10),
  })
  return [
    type('at_laptop', 1, 'Laptop', 'Laptops and notebooks.'),
    type('at_car', 2, 'Car', 'Company cars.'),
    type('at_mobile', 3, 'Mobile Phone', 'Phones on the company plan.'),
    type('at_storage', 4, 'Hard Drive', 'External drives.'),
    type('at_monitor', 5, 'Monitor', ''),
    type('at_printer', 6, 'Printer', 'No longer issued.', false),
  ]
}

interface AssetSeed {
  id: string
  name: string
  assetTypeId: string
  identificationNumber: string
  manufacturer: string
  model: string
  currentValue: number
  acquired: number
  condition?: Asset['condition']
  active?: boolean
}

const ASSETS: AssetSeed[] = [
  {
    id: 'as_1',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNumber: '123456789',
    manufacturer: 'Dell',
    model: 'TM-4356',
    currentValue: 100_000,
    acquired: 405,
  },
  {
    id: 'as_2',
    name: 'Hard Drive',
    assetTypeId: 'at_storage',
    identificationNumber: 'SG-2TB-7781',
    manufacturer: 'Seagate',
    model: 'Expansion 2TB',
    currentValue: 18_000,
    acquired: 380,
  },
  {
    id: 'as_3',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNumber: 'HP-840-55120',
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
    identificationNumber: 'LEB-21-4410',
    manufacturer: 'Toyota',
    model: 'Corolla Altis',
    currentValue: 5_800_000,
    acquired: 300,
  },
  {
    id: 'as_5',
    name: 'Mobile Phone',
    assetTypeId: 'at_mobile',
    identificationNumber: '356789104455120',
    manufacturer: 'Samsung',
    model: 'Galaxy A54',
    currentValue: 95_000,
    acquired: 260,
  },
  {
    id: 'as_6',
    name: 'Monitor',
    assetTypeId: 'at_monitor',
    identificationNumber: 'LG-27-90031',
    manufacturer: 'LG',
    model: '27UL500',
    currentValue: 65_000,
    acquired: 700,
    condition: 'old',
    active: false,
  },
  {
    id: 'as_7',
    name: 'Laptop',
    assetTypeId: 'at_laptop',
    identificationNumber: 'LN-E14-33017',
    manufacturer: 'Lenovo',
    model: 'ThinkPad E14',
    currentValue: 150_000,
    acquired: 560,
    condition: 'old',
  },
  {
    id: 'as_8',
    name: 'Mobile Phone',
    assetTypeId: 'at_mobile',
    identificationNumber: '353211087761204',
    manufacturer: 'Apple',
    model: 'iPhone 13',
    currentValue: 180_000,
    acquired: 130,
  },
  {
    id: 'as_9',
    name: 'Monitor',
    assetTypeId: 'at_monitor',
    identificationNumber: 'DL-P24-11908',
    manufacturer: 'Dell',
    model: 'P2422H',
    currentValue: 55_000,
    acquired: 90,
  },
]

/** [id, person, asset, allocated days ago, deallocated days ago]. */
const ALLOCATIONS: [string, string, string, number, number | null][] = [
  ['al_1', 'em_hina', 'as_1', 300, null],
  ['al_2', 'em_ayesha', 'as_4', 200, null],
  ['al_3', 'em_talha', 'as_3', 380, null],
  ['al_4', 'em_talha', 'as_5', 250, null],
  // Nida Hassan returned hers at her clearance (approved), on her last working day.
  ['al_5', 'em_nida', 'as_7', 500, 50],
  ['al_6', 'em_shelley', 'as_8', 120, null],
]

export function seedAllocations(): AssetAllocation[] {
  return ALLOCATIONS.map(([id, employeeId, assetId, from, to]) => ({
    id,
    employeeId,
    assetId,
    allocationDate: day(from),
    deallocationDate: to === null ? null : day(to),
    attachmentName: null,
    description: '',
    createdAt: stamp(from),
  }))
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

export function seedAssets(): Asset[] {
  const typeName = (id: string) => seedAssetTypes().find((type) => type.id === id)?.name ?? id
  return ASSETS.map((seed) => {
    const condition = seed.condition ?? 'new'
    const active = seed.active ?? true
    const history: AssetHistoryEntry[] = [
      {
        id: `ah_${seed.id}_create`,
        action: 'Create',
        performedById: HR,
        performedAt: stamp(seed.acquired, '09:15'),
        changes: [
          { field: 'Name', oldValue: '', newValue: seed.name },
          { field: 'Asset Type', oldValue: '', newValue: typeName(seed.assetTypeId) },
          { field: 'Identification Number', oldValue: '', newValue: seed.identificationNumber },
          { field: 'Is Taxable', oldValue: '', newValue: 'Yes' },
          { field: 'Condition', oldValue: '', newValue: condition === 'new' ? 'New' : 'Old' },
          { field: 'Manufacturer', oldValue: '', newValue: seed.manufacturer },
          { field: 'Model', oldValue: '', newValue: seed.model },
          { field: 'Current Value', oldValue: '', newValue: String(seed.currentValue) },
          { field: 'Acquired Date', oldValue: '', newValue: day(seed.acquired) },
        ],
      },
    ]
    for (const [id, employeeId, assetId, from, to] of ALLOCATIONS) {
      if (assetId !== seed.id) continue
      history.push({
        id: `ah_${id}_allocate`,
        action: 'Allocate',
        performedById: HR,
        performedAt: stamp(from, '11:00'),
        changes: [{ field: 'Allocated To', oldValue: '', newValue: nameOf(employeeId) }],
      })
      if (to !== null) {
        history.push({
          id: `ah_${id}_clearance`,
          action: 'Clearance',
          performedById: HR,
          performedAt: stamp(to - 1, '15:40'),
          changes: [
            { field: 'Allocated To', oldValue: nameOf(employeeId), newValue: '' },
            { field: 'Return Status', oldValue: '', newValue: 'Complete Return' },
          ],
        })
      }
    }
    if (!active) {
      history.push({
        id: `ah_${seed.id}_deactivate`,
        action: 'Deactivate',
        performedById: HR,
        performedAt: stamp(40, '12:05'),
        changes: [{ field: 'Active', oldValue: yesNo(true), newValue: yesNo(false) }],
      })
    }
    return {
      id: seed.id,
      code: `AST-${seed.id.replace('as_', '').padStart(5, '0')}`,
      name: seed.name,
      assetTypeId: seed.assetTypeId,
      identificationNumber: seed.identificationNumber,
      taxable: true,
      condition,
      manufacturer: seed.manufacturer,
      model: seed.model,
      attachmentName: null,
      currentValue: seed.currentValue,
      acquiredDate: day(seed.acquired),
      description: '',
      active,
      createdAt: stamp(seed.acquired, '09:15'),
      history: history.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    }
  })
}

/**
 * The two leavers Payroll's Final Settlement already has: Nida Hassan's form
 * approved on her last day, Talha Aziz's pending with HR (laptop and phone).
 */
export function seedClearances(): ClearanceForm[] {
  return [
    {
      id: 'cf_1',
      employeeId: 'em_nida',
      clearanceDate: day(50),
      lines: [
        {
          id: 'cl_1',
          assetId: 'as_7',
          allocationId: 'al_5',
          dateAllocated: day(500),
          condition: 'good',
          reason: 'Resignation',
          returnStatus: 'complete',
          comments: '',
        },
      ],
      checkedById: 'em_hina',
      approvedById: HR,
      approvalDate: day(49),
      attachmentName: null,
      status: 'approved',
      endOfEmploymentId: 'eoe_2',
      createdAt: stamp(52),
      effects: { deallocated: ['al_5'], deactivated: [] },
    },
    {
      id: 'cf_2',
      employeeId: 'em_talha',
      clearanceDate: day(15),
      lines: [
        {
          id: 'cl_2',
          assetId: 'as_3',
          allocationId: 'al_3',
          dateAllocated: day(380),
          condition: 'good',
          reason: 'Resignation',
          returnStatus: 'complete',
          comments: '',
        },
        {
          id: 'cl_3',
          assetId: 'as_5',
          allocationId: 'al_4',
          dateAllocated: day(250),
          condition: 'fair',
          reason: 'Resignation',
          returnStatus: 'partial',
          comments: 'Charger not returned.',
        },
      ],
      checkedById: 'em_hina',
      approvedById: HR,
      approvalDate: day(14),
      attachmentName: null,
      status: 'pending',
      endOfEmploymentId: 'eoe_1',
      createdAt: stamp(16),
      effects: null,
    },
  ]
}
