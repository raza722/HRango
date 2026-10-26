import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { z } from 'zod'

import type { EoeReason } from '@/features/offboarding'

import { endOfEmployments } from '../../../offboarding/db'
import { createId } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { invalid, now, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Resignation (`/requests/resignation`, details = ResignationDetails): the
 * person (or HR, from All Resignations) gives notice with a Type, the
 * Resignation Date, an optional Last Working Date (the approver may set it),
 * the notice period, Serve Notice, a Reason and an optional attachment. The
 * approver may set the last working date, serve notice and the notice period
 * (`details` of the approval). Approval opens an End of Employment record in
 * Off-boarding (pending, for HR to finish); an approved cancellation takes it
 * out again while HR has not started on it.
 */

const TYPE_VALUES = ['resignation', 'voluntary', 'retirement', 'contract_end'] as const
type ResignationType = (typeof TYPE_VALUES)[number]

/** The End of Employment reason each type opens. */
const EOE_REASON: Record<ResignationType, EoeReason> = {
  resignation: 'resignation',
  voluntary: 'resignation',
  retirement: 'retirement',
  contract_end: 'other',
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  resignationType: z.enum(TYPE_VALUES).default('resignation'),
  resignationDate: z.string().regex(ymd).nullish(),
  lastWorkingDate: z.string().regex(ymd).nullish(),
  noticePeriodDays: z.number().int().min(0).nullish(),
  serveNotice: z.boolean().default(false),
  reason: z.string(),
  description: z.string().nullish(),
})
type Input = z.infer<typeof schema>

export interface ResignationStored {
  resignationType: ResignationType
  resignationDate: string
  lastWorkingDate: string | null
  noticePeriodDays: number | null
  serveNotice: boolean
  reason: string
  description: string | null
}

/** What approval changed: the End of Employment record it opened, if any. */
interface Effect {
  endOfEmploymentId: string | null
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const stored = (record: StoredStandardRequest) => record.payload as unknown as ResignationStored
const daysBetween = (from: string, to: string | null) =>
  to ? differenceInCalendarDays(day(to), day(from)) : null

const ACTIVE = ['pending', 'completed', 'cancelling'] as const

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  if (!input.reason.trim()) return invalid('Reason is required.', { reason: 'Reason is required.' })
  const resignationDate = input.resignationDate ?? today()
  const lastWorkingDate = input.lastWorkingDate ?? null
  if (lastWorkingDate && lastWorkingDate < resignationDate) {
    return invalid('The last working date cannot be before the resignation date.', {
      lastWorkingDate: 'The last working date cannot be before the resignation date.',
    })
  }
  // One resignation at a time: a second one waits until the first is rejected or cancelled.
  const open = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === context.employeeId &&
      (ACTIVE as readonly string[]).includes(record.status),
  )
  if (open) {
    return invalid(
      `${mustFind(context.employeeId).name} already has resignation ${open.code} on the way.`,
    )
  }
  return {
    resignationType: input.resignationType,
    resignationDate,
    lastWorkingDate,
    noticePeriodDays: input.noticePeriodDays ?? daysBetween(resignationDate, lastWorkingDate),
    serveNotice: input.serveNotice,
    reason: input.reason.trim(),
    description: input.description?.trim() ?? null,
  } satisfies ResignationStored
}

/** `details` of the approval (ApprovalDetailsIn): what an approver of a resignation enters. */
const decisionSchema = z.object({
  lastWorkingDate: z.string().regex(ymd).nullish(),
  serveNotice: z.boolean().nullish(),
  noticePeriodDays: z.number().int().min(0).nullish(),
})

/** As `req.usp_request_decide`: each value is kept when given. */
function applyResignationDecision(
  record: StoredStandardRequest,
  extras: Record<string, unknown>,
): Response | Record<string, unknown> {
  const payload = stored(record)
  const parsed = decisionSchema.safeParse(extras)
  if (!parsed.success) return invalid('The approval details are not valid.')
  const { lastWorkingDate, serveNotice, noticePeriodDays } = parsed.data
  if (lastWorkingDate && lastWorkingDate < payload.resignationDate) {
    const message = 'The last working date cannot be before the resignation date.'
    return invalid(message, { lastWorkingDate: message })
  }
  const last = lastWorkingDate ?? payload.lastWorkingDate
  const next: ResignationStored = {
    ...payload,
    lastWorkingDate: last,
    serveNotice: serveNotice ?? payload.serveNotice,
    noticePeriodDays:
      noticePeriodDays ?? payload.noticePeriodDays ?? daysBetween(payload.resignationDate, last),
  }
  return { ...next }
}

/**
 * Opens a pending End of Employment record for HR, unless the person already
 * has one open (then nothing is added).
 */
function openEndOfEmployment(record: StoredStandardRequest): Effect {
  const payload = stored(record)
  const open = endOfEmployments
    .all()
    .some((item) => item.employeeId === record.employeeId && item.status === 'pending')
  if (open) return { endOfEmploymentId: null }
  const id = createId('eoe')
  endOfEmployments.insert({
    id,
    employeeId: record.employeeId,
    reason: EOE_REASON[payload.resignationType],
    noticePeriod: payload.serveNotice,
    noticePeriodDays: payload.noticePeriodDays,
    lastWorkingDate: payload.lastWorkingDate,
    // HR ticks these on the record when it is worked on.
    finalSettlement: false,
    assetClearance: false,
    attachmentName: null,
    description: `Resignation ${record.code}: ${payload.reason}`,
    delegateeId: null,
    checklist: {},
    status: 'pending',
    createdAt: now(),
    completedAt: null,
    finalSettlementId: null,
    clearanceId: null,
    rehire: null,
    resignationRequestId: record.id,
  })
  return { endOfEmploymentId: id }
}

/** Takes the record out again while it is untouched (pending, no settlement or clearance yet). */
function closeEndOfEmployment(record: StoredStandardRequest): void {
  const effect = record.effect as Effect | undefined
  const id = effect?.endOfEmploymentId
  if (!id) return
  const item = endOfEmployments.find(id)
  if (item?.status === 'pending' && !item.finalSettlementId && !item.clearanceId) {
    endOfEmployments.remove(id)
  }
}

const def: StandardKindServer<Input> = {
  kind: 'resignation',
  typeCode: 'resignation',
  typeName: 'Resignation',
  settingsType: 'resignation',
  codePrefix: 'RQ-RSG-',
  codeDigits: 4,
  fromBody: (body: RequestBodyIn) => ({
    ...body.details,
    reason: body.reason ?? '',
    description: body.description ?? null,
  }),
  schema,
  toPayload,
  dateOf: (payload) => String(payload.resignationDate),
  header: (payload) => {
    const value = payload as unknown as ResignationStored
    return {
      fromDate: value.resignationDate,
      toDate: value.lastWorkingDate ?? value.resignationDate,
      days: null,
      reason: value.reason,
      description: value.description,
      application: null,
    }
  },
  toDetails: (payload) => {
    const value = payload as unknown as ResignationStored
    return {
      resignationType: value.resignationType,
      resignationDate: value.resignationDate,
      lastWorkingDate: value.lastWorkingDate,
      noticePeriodDays: value.noticePeriodDays,
      serveNotice: value.serveNotice,
    }
  },
  decision: {
    schema: z.record(z.string(), z.unknown()),
    apply: applyResignationDecision,
  },
  onCompleted: openEndOfEmployment,
  onCancelled: closeEndOfEmployment,
  seed: () => {
    const start = (offset: number) => iso(addDays(new Date(), offset))
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const make = (
      number: number,
      employeeId: string,
      status: StoredStandardRequest['status'],
      options: {
        daysAgo: number
        notice?: number | null
        type?: ResignationType
        reason: string
        approvedSteps?: number
        cancelReason?: string
      },
    ) => {
      const digits = String(number).padStart(4, '0')
      const resignationDate = start(-options.daysAgo)
      const notice = options.notice === undefined ? 30 : options.notice
      return seedRequest(def, {
        id: `rsg_${digits}`,
        code: `RQ-RSG-${digits}`,
        employeeId,
        payload: {
          resignationType: options.type ?? 'voluntary',
          resignationDate,
          lastWorkingDate: notice === null ? null : iso(addDays(day(resignationDate), notice)),
          noticePeriodDays: notice,
          serveNotice: notice !== null,
          reason: options.reason,
          description: null,
        } satisfies ResignationStored,
        at: at(options.daysAgo),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
      })
    }
    return [
      make(1, 'em_sadia', 'pending', {
        daysAgo: 1,
        notice: null,
        reason: 'Moving to another city with my family.',
      }),
      make(2, 'em_rehan', 'pending', { daysAgo: 2, reason: 'Accepted an offer abroad.' }),
      make(3, 'em_maryam', 'pending', {
        daysAgo: 3,
        approvedSteps: 1,
        reason: 'Starting a master’s degree.',
      }),
      make(4, 'em_omer', 'completed', {
        daysAgo: 10,
        notice: 45,
        reason: 'Joining the family business.',
      }),
      make(5, 'em_laiba', 'cancelling', {
        daysAgo: 12,
        reason: 'Relocating for my spouse’s job.',
        cancelReason: 'The move is off; I would like to stay.',
      }),
      make(6, 'em_shelley', 'pending', {
        daysAgo: 0,
        notice: 60,
        reason: 'Relocating abroad next year.',
      }),
      make(7, 'em_shelley', 'rejected', { daysAgo: 120, reason: 'Health reasons.' }),
      make(8, 'em_shelley', 'cancelled', {
        daysAgo: 200,
        reason: 'Offer from another company.',
        cancelReason: 'Counter-offer accepted.',
      }),
      make(9, 'em_mahnoor', 'rejected', {
        daysAgo: 6,
        type: 'contract_end',
        reason: 'My contract ends this quarter.',
      }),
    ]
  },
}

export const resignationServer = defineStandardKind(def)
