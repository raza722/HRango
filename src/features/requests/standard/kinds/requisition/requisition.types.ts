/** What is asked for: the API's `requisitionType`. */
export const REQUISITION_TYPES = [
  'stationery',
  'it_equipment',
  'furniture',
  'asset',
  'consumable',
  'service',
  'other',
] as const
export type RequisitionType = (typeof REQUISITION_TYPES)[number]

/** One item asked for (`details.lines[]`). */
export interface RequisitionLine {
  id: string
  lineNo: number
  itemName: string
  quantity: number
  unit: string | null
  estimatedUnitCost: number | null
  description: string | null
}

/** A requisition's `details` as the API sends them (`/requests/requisition`). */
export interface RequisitionPayload {
  title: string
  requisitionType: RequisitionType
  neededByDate: string
  deliveryLocation: string | null
  /** Sum of quantity × estimated unit cost (the flow condition `amount`). */
  estimatedAmount: number | null
  currency: string | null
  lines: RequisitionLine[]
}

export interface RequisitionLineInput {
  itemName: string
  quantity: number
  unit: string | null
  estimatedUnitCost: number | null
  description: string | null
}

/** `RequisitionDetails` as the form sends them; the justification is the request's reason. */
export interface RequisitionDetailsInput {
  title: string
  requisitionType: RequisitionType
  neededByDate: string
  deliveryLocation: string | null
  lines: RequisitionLineInput[]
}
