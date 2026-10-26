import type { PunchRequestType } from '@/features/requests'

import type { StoredFile } from './backend'
import {
  type AppliedEffect,
  buildFlow,
  type FlowFacts,
  historyEntry,
  planFlow,
  type StoredConsent,
  type StoredPunchRequest,
  type StoredStep,
} from './flow'

/*
 * Punch, Shift and Transfer as the mock stores them: the planned flow,
 * consents and history (see flow.ts) with each type's own fields. The API
 * shapes are made from these in handlers.ts / transfer-handlers.ts.
 */

type CoreBase = Omit<StoredPunchRequest, 'kind' | 'payload' | 'applied'> & {
  /** What an approval changed, so an approved cancellation can put it back. */
  applied: AppliedEffect | null
  /** Uploaded files (`attachments: [fileId]`). */
  files?: StoredFile[]
}

/** The header fields the API keeps on the request itself. */
interface CoreHeader {
  reason: string | null
  description: string | null
}

export type StoredCorePunch = CoreBase & {
  kind: 'punch'
  payload: CoreHeader & {
    date: string
    punchType: PunchRequestType
    /** `HH:mm`. */
    punchTime: string
  }
}

export type StoredCoreShift = CoreBase & {
  kind: 'shift'
  payload: CoreHeader & {
    date: string
    /** A new time slot for the day (the mock's time slots are the roster groups). */
    timeSlotId: string | null
    /** Or a swap with this colleague, who consents first. */
    swapWithId: string | null
    /** The shift the person had that day, and the colleague's (names, as the API gives them). */
    fromSlotName: string | null
    toSlotName: string | null
  }
}

/** A stored transfer request: the shared request fields plus where the person moves. */
export type StoredTransferRequest = CoreBase & {
  kind: 'transfer'
  payload: CoreHeader & {
    /** Where the person worked when they asked. */
    fromLocationId: string | null
    fromBranchId: string | null
    fromDepartment: string
    locationId: string
    branchId: string
    departmentId: string
    /** The department's name (the mock's departments are the directory's names). */
    department: string
    lineManagerId: string
    finalAuthorityId: string
    effectiveDate: string
    application: string | null
  }
}

export type StoredCoreRequest = StoredCorePunch | StoredCoreShift | StoredTransferRequest

/** The page's kind → the API's request type code (flows, delegations, restrictions). */
export const CORE_TYPE_CODES = {
  punch: 'punch',
  shift: 'shift_swap',
  transfer: 'transfer',
} as const

/**
 * A fresh request through its type's flow, with "Requested" in its history.
 * `consentIds` are asked before the flow starts (a shift swap's colleague): the
 * first approval step waits until they answer, as on the API.
 */
export function newCoreRecord<T extends StoredCoreRequest>(
  base: Pick<T, 'id' | 'code' | 'kind' | 'employeeId' | 'createdById' | 'payload'> & {
    consentIds?: string[]
  },
  facts: FlowFacts,
  at: string,
): T {
  const { consentIds = [], ...rest } = base
  const plan = planFlow(base.employeeId, CORE_TYPE_CODES[base.kind], facts)
  const asked = [...new Set([...consentIds, ...plan.consentIds])]
  const steps: StoredStep[] =
    consentIds.length > 0
      ? plan.steps.map((step) =>
          step.status === 'pending' ? { ...step, status: 'waiting' } : step,
        )
      : plan.steps
  return {
    ...rest,
    status: 'pending',
    flow: steps,
    consents: asked.map((personId): StoredConsent => ({
      personId,
      status: 'pending',
      remarks: null,
    })),
    cancelReason: null,
    cancelStep: null,
    history: [
      historyEntry(base.createdById, 'Requested', null, at),
      ...plan.lookerIds.map((personId) => historyEntry(personId, 'Informed (On Looker)', null, at)),
    ],
    applied: null,
    files: [],
    createdAt: at,
    updatedAt: at,
  } as unknown as T
}

/** Once every consent is answered, the first approval step starts waiting for its approver. */
export function releaseFlow<T extends StoredCoreRequest>(record: T): T {
  if (record.consents.some((consent) => consent.status === 'pending')) return record
  if (record.flow.some((step) => step.status !== 'waiting')) return record
  return {
    ...record,
    flow: record.flow.map((step, index) => (index === 0 ? { ...step, status: 'pending' } : step)),
  }
}

/** The person asks to cancel an approved request; the last approver of the cancel flow decides. */
export function requestCoreCancel<T extends StoredCoreRequest>(
  record: T,
  actorId: string,
  reason: string,
  at: string,
): T {
  const final =
    buildFlow(record.employeeId, `${CORE_TYPE_CODES[record.kind]}-cancel`).at(-1) ??
    record.flow.at(-1)
  return {
    ...record,
    status: 'cancelling',
    cancelReason: reason,
    cancelStep: final
      ? { ...final, status: 'pending', actedById: null, actedAt: null, remarks: null }
      : null,
    updatedAt: at,
    history: [...record.history, historyEntry(actorId, 'Cancellation requested', reason, at)],
  }
}
