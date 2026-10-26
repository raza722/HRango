import type { RequisitionType } from './requisition.types'

export const REQUISITION_TYPE_LABELS: Record<RequisitionType, string> = {
  stationery: 'Stationery',
  it_equipment: 'IT Equipment',
  furniture: 'Furniture',
  asset: 'Asset',
  consumable: 'Consumable',
  service: 'Service',
  other: 'Other',
}
