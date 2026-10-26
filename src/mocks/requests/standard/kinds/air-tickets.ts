import { addDays, format } from 'date-fns'
import { z } from 'zod'

import { mockFileUrl } from '../../../files/handlers'
import { errorResponse } from '../../../utils'
import { textOrNull } from '../../backend'
import { invalid, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import { reimbursementSetting } from './expense'

/*
 * Air ticket claims (backend `/requests/air-ticket`): title, claim date
 * (today when empty, never ahead), travel date, from / to, amount,
 * description and the ticket file. One live claim per travel date
 * (AIR_TICKET_DUPLICATE, 409); no air ticket pay item under Request Settings →
 * Reimbursement refuses it (AIR_TICKET_NOT_PAYABLE). The approver may lower it
 * (`details.approvedAmount`); approval pays it through payroll.
 */

export interface AirTicketStored {
  title: string
  claimDate: string
  travelDate: string
  fromPlace: string | null
  toPlace: string | null
  amount: number
  approvedAmount: number | null
  description: string | null
  fileId: string | null
}

interface Effect {
  paidInMonth: string
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const id = z.union([z.string(), z.number()]).transform(String)
const amount = z.union([z.number(), z.string()]).transform(Number)

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  claimDate: z.string().regex(ymd).nullish(),
  travelDate: z.string().regex(ymd),
  fromPlace: z.string().trim().max(200).nullish(),
  toPlace: z.string().trim().max(200).nullish(),
  amount: amount.pipe(z.number().gt(0)),
  description: z.string().max(4000).nullish(),
  fileId: id.nullish(),
})
type Input = z.infer<typeof schema>

const stored = (record: StoredStandardRequest) => record.payload as unknown as AirTicketStored
const LIVE = ['pending', 'completed', 'cancelling'] as const

const refused = (status: number, message: string, code: string, field: string) =>
  errorResponse(status, message, { code, fieldErrors: { [field]: message } })

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const claimDate = input.claimDate ?? today()
  if (claimDate > today()) {
    return invalid('A claim date cannot be in the future.', {
      claimDate: 'Choose today or an earlier day',
    })
  }
  if (!reimbursementSetting().airTicketPayItemId) {
    return refused(
      422,
      'There is no air ticket pay item to pay this claim. Set one under Expense → Settings.',
      'AIR_TICKET_NOT_PAYABLE',
      'amount',
    )
  }
  const duplicate = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === context.employeeId &&
      (LIVE as readonly string[]).includes(record.status) &&
      stored(record).travelDate === input.travelDate,
  )
  if (duplicate) {
    return refused(
      409,
      `${mustFind(context.employeeId).name} already claimed a ticket for this travel date (${duplicate.code}).`,
      'AIR_TICKET_DUPLICATE',
      'travelDate',
    )
  }
  return {
    title: input.title,
    claimDate,
    travelDate: input.travelDate,
    fromPlace: textOrNull(input.fromPlace),
    toPlace: textOrNull(input.toPlace),
    amount: input.amount,
    approvedAmount: null,
    description: textOrNull(input.description),
    fileId: input.fileId ?? null,
  } satisfies AirTicketStored
}

const isApproved = (record: StoredStandardRequest) =>
  record.status === 'completed' || record.status === 'cancelling'

const decisionSchema = z.object({ approvedAmount: amount.pipe(z.number().gt(0)).nullish() })

const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const firstOfMonth = () => `${today().slice(0, 7)}-01`

const def: StandardKindServer<Input> = {
  kind: 'air-tickets',
  typeCode: 'air_ticket',
  typeName: 'Air Ticket',
  settingsType: 'air_ticket',
  codePrefix: 'AIR-',
  codeDigits: 4,
  fromBody: (body) => body.details,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.travelDate),
  header: (payload) => ({
    fromDate: String(payload.travelDate),
    toDate: String(payload.travelDate),
    days: null,
    reason: null,
    description: null,
    application: null,
  }),
  toDetails: (payload, record) => {
    const value = payload as unknown as AirTicketStored
    const effect = record.effect as Effect | undefined
    return {
      ...value,
      approvedAmount: value.approvedAmount ?? (isApproved(record) ? value.amount : null),
      currency: 'PKR',
      fileName: value.fileId ? `ticket-${value.fileId}.pdf` : null,
      fileUrl: value.fileId ? mockFileUrl(value.fileId) : null,
      openingBalanceId: effect ? `ob_${record.id}` : null,
      paidInMonth: effect?.paidInMonth ?? null,
    }
  },
  decision: {
    schema: z.record(z.string(), z.unknown()),
    apply: (record, extras) => {
      const parsed = decisionSchema.safeParse(extras)
      if (!parsed.success) {
        return invalid('Enter an approved amount above 0.', {
          approvedAmount: 'Enter an amount above 0',
        })
      }
      const value = stored(record)
      const approved = parsed.data.approvedAmount ?? null
      if (approved !== null && approved > value.amount) {
        return invalid('The approved amount cannot be more than the claim.', {
          approvedAmount: 'Not more than the claim',
        })
      }
      return {
        ...value,
        approvedAmount: approved ?? value.approvedAmount,
      } satisfies AirTicketStored
    },
  },
  onCompleted: (): Effect => ({ paidInMonth: firstOfMonth() }),
  seed: () => {
    const day = (offset: number) => iso(addDays(new Date(), offset))
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const ticket = (
      title: string,
      travel: number,
      fare: number,
      route: [string, string],
    ): Record<string, unknown> =>
      ({
        title,
        claimDate: day(-1),
        travelDate: day(travel),
        fromPlace: route[0],
        toPlace: route[1],
        amount: fare,
        approvedAmount: null,
        description: 'Client meeting.',
        fileId: null,
      }) satisfies AirTicketStored
    return [
      seedRequest(def, {
        id: 'air_0001',
        code: 'AIR-0001',
        employeeId: 'em_sadia',
        payload: ticket('Lahore to Karachi', 12, 32_000, ['Lahore', 'Karachi']),
        at: at(1),
      }),
      seedRequest(def, {
        id: 'air_0002',
        code: 'AIR-0002',
        employeeId: 'em_shelley',
        payload: ticket('Islamabad workshop', 20, 18_500, ['Lahore', 'Islamabad']),
        at: at(2),
      }),
      seedRequest(def, {
        id: 'air_0003',
        code: 'AIR-0003',
        employeeId: 'em_omer',
        payload: ticket('Dubai audit', -10, 95_000, ['Lahore', 'Dubai']),
        at: at(25),
        status: 'completed',
      }),
    ].map((record) =>
      record.status === 'completed'
        ? { ...record, effect: { paidInMonth: firstOfMonth() } satisfies Effect }
        : record,
    )
  },
}

export const airTicketsServer = defineStandardKind(def)
