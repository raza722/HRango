import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { z } from 'zod'

import type { EoeReason } from '@/features/offboarding'

import { endOfEmployments } from '../../../offboarding/db'
import { createId } from '../../../utils'
import { invalid, now, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Resignation: the person (or HR, from All Resignations) gives notice with a
 * Type, the Resignation Date, the Last Working Date (the design puts it on
 * the request), a Reason and an optional Attachment. Notice Period is the
 * days between the two dates. Approval opens an End of Employment record in
 * Off-boarding (pending, for HR to finish); an approved cancellation takes it
 * out again while HR has not started on it.
 */

const TYPE_VALUES = ['voluntary', 'retirement', 'contract-end'] as const
type ResignationType = (typeof TYPE_VALUES)[number]

/** The Type options and the End of Employment reason each one opens. */
const TYPES: Record<ResignationType, { label: string; reason: EoeReason }> = {
  voluntary: { label: 'Voluntary', reason: 'resignation' },
  retirement: { label: 'Retirement', reason: 'retirement' },
  'contract-end': { label: 'Contract End', reason: 'other' },
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  type: z.enum(TYPE_VALUES),
  resignationDate: z.string().regex(ymd),
  lastWorkingDate: z.string().regex(ymd),
  reason: z.string().trim().min(1).max(500),
  attachmentName: z.string().trim().max(200).nullable(),
})
type Input = z.infer<typeof schema>

export interface ResignationStored {
  type: ResignationType
  resignationDate: string
  lastWorkingDate: string
  reason: string
  attachmentName: string | null
}

/** What approval changed: the End of Employment record it opened, if any. */
interface Effect {
  endOfEmploymentId: string | null
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const stored = (record: StoredStandardRequest) => record.payload as unknown as ResignationStored
const noticeDays = (payload: ResignationStored) =>
  differenceInCalendarDays(day(payload.lastWorkingDate), day(payload.resignationDate))

const ACTIVE = ['pending', 'completed', 'cancelling'] as const
const STATUS_WORDS: Record<(typeof ACTIVE)[number], string> = {
  pending: 'waiting for approval',
  completed: 'approved',
  cancelling: 'waiting for its cancellation',
}

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const earliest = iso(addDays(day(today()), -30))
  const latest = iso(addDays(day(today()), 90))
  if (input.resignationDate < earliest) {
    return invalid('The resignation date can be at most 30 days back.', {
      resignationDate: 'Choose a day in the last 30 days or later',
    })
  }
  if (input.resignationDate > latest) {
    return invalid('The resignation date can be at most 90 days ahead.', {
      resignationDate: 'Choose a day in the next 90 days',
    })
  }
  if (input.lastWorkingDate < input.resignationDate) {
    return invalid('The last working date comes before the resignation date.', {
      lastWorkingDate: 'Choose the resignation date or a later day',
    })
  }
  if (differenceInCalendarDays(day(input.lastWorkingDate), day(input.resignationDate)) > 180) {
    return invalid('The notice period can be 180 days at most.', {
      lastWorkingDate: 'Choose a day within 180 days of the resignation date',
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
    const status = open.status as (typeof ACTIVE)[number]
    return invalid(
      `${mustFind(context.employeeId).name} already has resignation ${open.code} ${STATUS_WORDS[status]}.`,
    )
  }
  return {
    type: input.type,
    resignationDate: input.resignationDate,
    lastWorkingDate: input.lastWorkingDate,
    reason: input.reason,
    attachmentName: input.attachmentName === '' ? null : input.attachmentName,
  } satisfies ResignationStored
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
    reason: TYPES[payload.type].reason,
    noticePeriod: noticeDays(payload) > 0,
    lastWorkingDate: payload.lastWorkingDate,
    // HR ticks these on the record when it is worked on.
    finalSettlement: false,
    assetClearance: false,
    attachmentName: payload.attachmentName,
    description: `Resignation ${record.code}: ${payload.reason}`,
    delegateeId: null,
    checklist: {},
    status: 'pending',
    createdAt: now(),
    completedAt: null,
    finalSettlementId: null,
    clearanceId: null,
    rehire: null,
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
  settingsType: 'resignation',
  codePrefix: 'RSG-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.resignationDate),
  present: (payload, record) => {
    const value = payload as unknown as ResignationStored
    const days = noticeDays(value)
    const effect = record.effect as Effect | undefined
    return {
      ...value,
      typeLabel: TYPES[value.type].label,
      noticeDays: days,
      noticePeriod: `${String(days)} ${days === 1 ? 'day' : 'days'}`,
      endOfEmploymentId: effect?.endOfEmploymentId ?? null,
    }
  },
  filters: {
    type: (record, value) => stored(record).type === value,
  },
  lookups: () => ({
    types: TYPE_VALUES.map((value) => ({ value, label: TYPES[value].label })),
  }),
  cancellationsView: true,
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
        notice?: number
        type?: ResignationType
        reason: string
        attachmentName?: string
        approvedSteps?: number
        cancelReason?: string
      },
    ) => {
      const digits = String(number).padStart(4, '0')
      const resignationDate = start(-options.daysAgo)
      return seedRequest(def, {
        id: `rsg_${digits}`,
        code: `RSG-${digits}`,
        employeeId,
        payload: {
          type: options.type ?? 'voluntary',
          resignationDate,
          lastWorkingDate: iso(addDays(day(resignationDate), options.notice ?? 30)),
          reason: options.reason,
          attachmentName: options.attachmentName ?? null,
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
        reason: 'Moving to another city with my family.',
        attachmentName: 'resignation-letter.pdf',
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
        attachmentName: 'notice.pdf',
      }),
      make(7, 'em_shelley', 'rejected', { daysAgo: 120, reason: 'Health reasons.' }),
      make(8, 'em_shelley', 'cancelled', {
        daysAgo: 200,
        reason: 'Offer from another company.',
        cancelReason: 'Counter-offer accepted.',
      }),
      make(9, 'em_mahnoor', 'rejected', {
        daysAgo: 6,
        type: 'contract-end',
        reason: 'My contract ends this quarter.',
      }),
    ]
  },
}

export const resignationServer = defineStandardKind(def)
