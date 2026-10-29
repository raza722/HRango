import { addDays, format } from 'date-fns'
import { z } from 'zod'

import { textOrNull } from '../../backend'
import { invalid, today } from '../../http'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Requisitions (backend `/requests/requisition`, designed by the backend; no
 * form in any document): title, type, needed-by date (not before today),
 * delivery location, items (name, quantity > 0, unit, estimated unit cost ≥ 0,
 * description) and the justification (the request's reason, required).
 * Approval only: the API tells who fulfils it; nothing is stocked.
 */

const TYPES = [
  'stationery',
  'it_equipment',
  'furniture',
  'asset',
  'consumable',
  'service',
  'other',
] as const

export interface RequisitionLineStored {
  id: string
  lineNo: number
  itemName: string
  quantity: number
  unit: string | null
  estimatedUnitCost: number | null
  description: string | null
}

export interface RequisitionStored {
  title: string
  requisitionType: (typeof TYPES)[number]
  neededByDate: string
  deliveryLocation: string | null
  lines: RequisitionLineStored[]
  reason: string
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const number = z.union([z.number(), z.string()]).transform(Number)

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  requisitionType: z.enum(TYPES),
  neededByDate: z.string().regex(ymd),
  deliveryLocation: z.string().trim().max(200).nullish(),
  lines: z
    .array(
      z.object({
        itemName: z.string().trim().min(1).max(200),
        // Whole items only (2.5 chairs is refused).
        quantity: number.pipe(
          z.number().int('Enter a whole number').gt(0).max(100_000, 'Ask for 100,000 at most'),
        ),
        unit: z.string().trim().max(50).nullish(),
        estimatedUnitCost: number.pipe(z.number().min(0)).nullish(),
        description: z.string().max(4000).nullish(),
      }),
    )
    .min(1)
    .max(100),
  reason: z.string().trim().max(4000),
})
type Input = z.infer<typeof schema>

function toPayload(input: Input): Response | Record<string, unknown> {
  if (!input.reason) return invalid('Reason is required.', { reason: 'Reason is required.' })
  if (input.neededByDate < today()) {
    return invalid('The needed-by date cannot be before today.', {
      neededByDate: 'Choose today or a later day',
    })
  }
  return {
    title: input.title,
    requisitionType: input.requisitionType,
    neededByDate: input.neededByDate,
    deliveryLocation: textOrNull(input.deliveryLocation),
    lines: input.lines.map((line, index) => ({
      id: String(index + 1),
      lineNo: index + 1,
      itemName: line.itemName,
      quantity: line.quantity,
      unit: textOrNull(line.unit),
      estimatedUnitCost: line.estimatedUnitCost ?? null,
      description: textOrNull(line.description),
    })),
    reason: input.reason,
  } satisfies RequisitionStored
}

const estimate = (value: RequisitionStored) => {
  const priced = value.lines.filter((line) => line.estimatedUnitCost !== null)
  return priced.length === 0
    ? null
    : priced.reduce((sum, line) => sum + line.quantity * (line.estimatedUnitCost ?? 0), 0)
}

const stored = (payload: Record<string, unknown>) => payload as unknown as RequisitionStored
const iso = (date: Date) => format(date, 'yyyy-MM-dd')

const def: StandardKindServer<Input> = {
  kind: 'requisition',
  typeCode: 'requisition',
  typeName: 'Requisition',
  settingsType: 'requisition',
  codePrefix: 'RQN-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.neededByDate),
  header: (payload) => ({
    fromDate: stored(payload).neededByDate,
    toDate: stored(payload).neededByDate,
    days: null,
    reason: stored(payload).reason,
    description: null,
    application: null,
  }),
  toDetails: (payload) => {
    const { reason: _reason, ...value } = stored(payload)
    return { ...value, estimatedAmount: estimate(stored(payload)), currency: 'PKR' }
  },
  seed: () => {
    const day = (offset: number) => iso(addDays(new Date(), offset))
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const requisition = (
      title: string,
      type: RequisitionStored['requisitionType'],
      lines: [string, number, number | null][],
    ): Record<string, unknown> =>
      ({
        title,
        requisitionType: type,
        neededByDate: day(14),
        deliveryLocation: 'Lahore Head Office',
        lines: lines.map(([itemName, quantity, cost], index) => ({
          id: String(index + 1),
          lineNo: index + 1,
          itemName,
          quantity,
          unit: 'pcs',
          estimatedUnitCost: cost,
          description: null,
        })),
        reason: 'New joiners start next month.',
      }) satisfies RequisitionStored
    const records: StoredStandardRequest[] = [
      seedRequest(def, {
        id: 'rqn_0001',
        code: 'RQN-0001',
        employeeId: 'em_sadia',
        payload: requisition('Laptops for new joiners', 'it_equipment', [
          ['Laptop', 2, 250_000],
          ['Mouse', 2, null],
        ]),
        at: at(1),
      }),
      seedRequest(def, {
        id: 'rqn_0002',
        code: 'RQN-0002',
        employeeId: 'em_shelley',
        payload: requisition('Office stationery', 'stationery', [
          ['A4 paper (ream)', 10, 1_200],
          ['Pens (box)', 5, 600],
        ]),
        at: at(4),
      }),
    ]
    return records
  },
}

export const requisitionServer = defineStandardKind(def)
