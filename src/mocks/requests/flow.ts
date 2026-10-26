import {
  FLOW_AUTHORITIES,
  FLOW_AUTHORITY_LABELS,
  type FlowAuthority,
  type FlowNode,
  type FlowStepStatus,
  type RequestStatus,
  type SettingsRequestType,
} from '@/features/requests'
import type { ScheduleEntry } from '@/features/scheduling'

import type { DirectoryEmployee } from '../employees/seed'
import { branches } from '../settings/handlers'
import { createId } from '../utils'
import {
  departmentHeadOf,
  headOfDepartment,
  hrManagerFor,
  lineManagerOf,
  mustFind,
  TOP_MANAGER,
} from './people'
import { authorityHolder, flowFor } from './settings-db'

export interface StoredStep {
  authority: string
  approverId: string
  status: FlowStepStatus
  actedById: string | null
  actedAt: string | null
  remarks: string | null
}

export interface StoredConsent {
  personId: string
  status: 'pending' | 'given' | 'declined'
  remarks: string | null
}

export interface StoredHistory {
  id: string
  byId: string
  delegate: boolean
  status: string
  remarks: string | null
  at: string
}

/** What an approval changed, so a cancellation can put it back. */
export type AppliedEffect =
  | { type: 'punch'; punchId: string }
  | { type: 'schedule'; before: { employeeId: string; entry: ScheduleEntry | null }[] }

interface StoredBase {
  id: string
  code: string
  status: RequestStatus
  employeeId: string
  createdById: string
  createdAt: string
  updatedAt: string
  flow: StoredStep[]
  consents: StoredConsent[]
  cancelReason: string | null
  /** The final authority deciding a cancellation. */
  cancelStep: StoredStep | null
  history: StoredHistory[]
  applied: AppliedEffect | null
}

export interface StoredPunchRequest extends StoredBase {
  kind: 'punch'
  payload: {
    date: string
    punchType: 'check-in' | 'check-out' | 'missing-punch'
    punchTime: string
    description: string
  }
}

export interface StoredShiftRequest extends StoredBase {
  kind: 'shift'
  payload: {
    date: string
    rosterGroupId: string | null
    rosterTitle: string | null
    swapFrom: string | null
    swapWithId: string | null
    swapToShift: string | null
    description: string
  }
}

export type StoredRequest = StoredPunchRequest | StoredShiftRequest

/** What the approval steps read and write: the fields every request kind shares. */
export type FlowRecord = StoredBase & { kind: string }

/** Facts a flow condition can test, e.g. `punchType == missing-punch` or `days > 3`. */
export type FlowFacts = Record<string, string | number | boolean | null>

/** Who a request goes to: approval steps, consents asked and on-lookers told. */
export interface FlowPlan {
  steps: StoredStep[]
  consentIds: string[]
  lookerIds: string[]
}

/**
 * `<fact> <op> <value>` (the API's conditions read days, amount, minutes,
 * department_id …; the mock reads any payload fact). As on the API, a fact the
 * request does not have, or an expression it cannot read, is false.
 */
export function evaluateCondition(expression: string | null, facts: FlowFacts): boolean {
  const match = /^\s*(\w+)\s*(>=|<=|==|!=|<>|=|>|<)\s*(.+?)\s*$/.exec(expression ?? '')
  if (!match) return false
  const [, name = '', op, raw = ''] = match
  const fact = facts[name]
  if (fact === undefined || fact === null) return false
  const value = raw.replace(/^['"]|['"]$/g, '')
  const left = typeof fact === 'number' ? fact : String(fact)
  const right = typeof fact === 'number' ? Number(value) : value
  switch (op) {
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '!=':
    case '<>':
      return left !== right
    default:
      return left === right
  }
}

/**
 * The fallbacks the mock uses for authorities nobody holds under Request
 * Settings → Authorities (the organisation's heads stand in).
 */
function defaultHolder(authority: FlowAuthority, employee: DirectoryEmployee): string | null {
  switch (authority) {
    case 'hr_manager':
      return hrManagerFor(employee)
    case 'finance_manager':
      return headOfDepartment('Finance')
    case 'admin_manager':
      return headOfDepartment('Operations')
    case 'area_manager':
      // Areas have no manager on file: the country manager stands in.
      return employee.id === TOP_MANAGER ? hrManagerFor(employee) : TOP_MANAGER
    default:
      return null
  }
}

/** Step labels the request serializer reads back as the API's approver kinds. */
const AUTHORITY_STEP_LABELS: Partial<Record<FlowAuthority, string>> = {
  hr_manager: 'HOD HR',
  finance_manager: 'HOD Finance',
  admin_manager: 'HOD Admin',
}

const isAuthority = (kind: string): kind is FlowAuthority =>
  (FLOW_AUTHORITIES as readonly string[]).includes(kind)

/** Who a flow node points at, with the label its approval is recorded under; null: nobody (skipped). */
function resolveNode(
  node: FlowNode,
  employee: DirectoryEmployee,
  type: string,
): [string, string] | null {
  const kind = node.approverKind
  if (!kind) return null
  switch (kind) {
    case 'line_manager':
      return ['Line Manager', lineManagerOf(employee)]
    case 'hod':
      return ['HOD', departmentHeadOf(employee)]
    case 'final_authority':
      return ['HR Manager', hrManagerFor(employee)]
    case 'branch_manager': {
      const branch = employee.branchId ? branches.find(employee.branchId) : undefined
      return ['Branch Manager', branch?.managerId ?? lineManagerOf(employee)]
    }
    case 'employee':
      return node.employeeId ? ['Employee', node.employeeId] : null
    case 'role':
      // The mock has no user roles: a role node is skipped.
      return null
    default: {
      if (!isAuthority(kind)) return null
      const holder = authorityHolder(kind, employee, type) ?? defaultHolder(kind, employee)
      return holder ? [AUTHORITY_STEP_LABELS[kind] ?? FLOW_AUTHORITY_LABELS[kind], holder] : null
    }
  }
}

/**
 * Walks the flow a person's request of a type follows (Request Settings →
 * Request Flows: the most specific active flow, else the General Flow) from
 * its first node. Empty Next / If True / If False go to the next node by
 * number. On-lookers are told, Can Disagree nodes are asked for consent, a
 * condition routes by its expression, and every other node is an approval
 * step. A node nobody holds, or that would make the person decide their own
 * request, is skipped; the same approver twice in a row decides once.
 */
export function planFlow(employeeId: string, type = 'punch', facts: FlowFacts = {}): FlowPlan {
  const employee = mustFind(employeeId)
  const nodes = flowFor(employee, type)
  const byStep = new Map(nodes.map((item) => [item.stepNo, item]))
  const following = (stepNo: number) => nodes.find((item) => item.stepNo > stepNo)?.stepNo ?? null
  const plan: FlowPlan = { steps: [], consentIds: [], lookerIds: [] }
  const seen = new Set<number>()
  let current: FlowNode | undefined = nodes[0]
  while (current && !seen.has(current.stepNo)) {
    seen.add(current.stepNo)
    const next: number | null = current.isCondition
      ? evaluateCondition(current.expression, facts)
        ? (current.ifTrue ?? following(current.stepNo))
        : (current.ifFalse ?? following(current.stepNo))
      : (current.next ?? following(current.stepNo))
    const resolved = current.isCondition ? null : resolveNode(current, employee, type)
    if (resolved && resolved[1] !== employeeId) {
      const [authority, approverId] = resolved
      if (current.isObserver) plan.lookerIds.push(approverId)
      else if (current.canDisagree) plan.consentIds.push(approverId)
      else {
        const last = plan.steps.at(-1)
        if (last?.approverId === approverId) plan.steps.pop()
        plan.steps.push({
          authority,
          approverId,
          status: 'waiting',
          actedById: null,
          actedAt: null,
          remarks: null,
        })
      }
    }
    current = next === null ? undefined : byStep.get(next)
  }
  if (plan.steps.length === 0) {
    plan.steps.push({
      authority: 'HR Manager',
      approverId: hrManagerFor(employee),
      status: 'waiting',
      actedById: null,
      actedAt: null,
      remarks: null,
    })
  }
  const [first] = plan.steps
  if (first) first.status = 'pending'
  plan.consentIds = [...new Set(plan.consentIds)]
  plan.lookerIds = [...new Set(plan.lookerIds)]
  return plan
}

/**
 * The approval steps of a request type's flow: by default Line Manager, then
 * HR Manager (one step when they are the same person).
 */
export function buildFlow(employeeId: string, type = 'punch', facts: FlowFacts = {}): StoredStep[] {
  return planFlow(employeeId, type, facts).steps
}

/** A request's plain payload fields, for flow conditions. */
function factsOf(payload: object): FlowFacts {
  const facts: FlowFacts = {}
  for (const [key, value] of Object.entries(payload) as [string, unknown][]) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      facts[key] = value
    }
  }
  return facts
}

export function currentStep(record: FlowRecord): StoredStep | null {
  if (record.status === 'cancelling') return record.cancelStep
  if (record.status !== 'pending') return null
  return record.flow.find((step) => step.status === 'pending') ?? null
}

function entry(byId: string, status: string, remarks: string | null, at: string, delegate = false) {
  return { id: createId('rh'), byId, delegate, status, remarks, at }
}

/** A fresh request, with "Requested" in its history. */
export function newRecord<T extends StoredRequest>(
  base: Omit<
    T,
    | 'status'
    | 'flow'
    | 'cancelReason'
    | 'cancelStep'
    | 'history'
    | 'applied'
    | 'createdAt'
    | 'updatedAt'
  >,
  at: string,
): T {
  const plan = planFlow(base.employeeId, base.kind, factsOf(base.payload))
  const asked = new Set(base.consents.map((consent) => consent.personId))
  const consents = [
    ...base.consents,
    ...plan.consentIds
      .filter((personId) => !asked.has(personId))
      .map((personId): StoredConsent => ({ personId, status: 'pending', remarks: null })),
  ]
  return {
    ...base,
    status: 'pending',
    flow: plan.steps,
    consents,
    cancelReason: null,
    cancelStep: null,
    history: [
      entry(base.createdById, 'Requested', null, at),
      ...plan.lookerIds.map((personId) => entry(personId, 'Informed (On Looker)', null, at)),
    ],
    applied: null,
    createdAt: at,
    updatedAt: at,
  } as T
}

/**
 * Records an approver's decision on the current step. Approving the last
 * step completes the request; rejecting any step rejects it.
 */
export function applyDecision<T extends FlowRecord>(
  record: T,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): { record: T; completed: boolean } {
  const index = record.flow.findIndex((step) => step.status === 'pending')
  const step = record.flow[index]
  if (!step) return { record, completed: false }
  const delegate = actorId !== step.approverId
  const flow = record.flow.map((item, position): StoredStep => {
    if (position === index) {
      return {
        ...item,
        status: decision === 'approve' ? 'approved' : 'rejected',
        actedById: actorId,
        actedAt: at,
        remarks,
      }
    }
    if (position === index + 1 && decision === 'approve') return { ...item, status: 'pending' }
    if (position > index && decision === 'reject') return { ...item, status: 'skipped' }
    return item
  })
  const last = index === record.flow.length - 1
  const completed = decision === 'approve' && last
  const status: RequestStatus =
    decision === 'reject' ? 'rejected' : completed ? 'completed' : 'pending'
  const label = `${decision === 'approve' ? 'Approved' : 'Rejected'} by ${step.authority}${last ? ' (Final Authority)' : ''}`
  return {
    record: {
      ...record,
      flow,
      status,
      updatedAt: at,
      history: [...record.history, entry(actorId, label, remarks, at, delegate)],
    },
    completed,
  }
}

/**
 * The person asks to cancel a completed request; the last approver of the
 * type's cancel flow ("Punch Cancel Request", by default the final
 * authority) decides.
 */
export function applyCancelRequest<T extends FlowRecord>(
  record: T,
  actorId: string,
  reason: string,
  at: string,
): T {
  const cancelType = `${record.kind as SettingsRequestType}-cancel` as const
  const final = buildFlow(record.employeeId, cancelType).at(-1) ?? record.flow.at(-1)
  return {
    ...record,
    status: 'cancelling',
    cancelReason: reason,
    cancelStep: final
      ? { ...final, status: 'pending', actedById: null, actedAt: null, remarks: null }
      : null,
    updatedAt: at,
    history: [...record.history, entry(actorId, 'Cancellation requested', reason, at)],
  }
}

export function applyCancelDecision<T extends FlowRecord>(
  record: T,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): T {
  const step = record.cancelStep
  const delegate = step !== null && actorId !== step.approverId
  return {
    ...record,
    status: decision === 'approve' ? 'cancelled' : 'completed',
    cancelStep: step
      ? {
          ...step,
          status: decision === 'approve' ? 'approved' : 'rejected',
          actedById: actorId,
          actedAt: at,
          remarks,
        }
      : null,
    updatedAt: at,
    history: [
      ...record.history,
      entry(
        actorId,
        decision === 'approve' ? 'Cancellation approved' : 'Cancellation rejected',
        remarks,
        at,
        delegate,
      ),
    ],
  }
}

export function applyConsent<T extends FlowRecord>(
  record: T,
  personId: string,
  decision: 'approve' | 'reject',
  remarks: string | null,
  at: string,
): T {
  return {
    ...record,
    consents: record.consents.map((consent) =>
      consent.personId === personId
        ? { ...consent, status: decision === 'approve' ? 'given' : 'declined', remarks }
        : consent,
    ),
    updatedAt: at,
    history: [
      ...record.history,
      entry(personId, decision === 'approve' ? 'Consent given' : 'Consent declined', remarks, at),
    ],
  }
}

export function historyEntry(byId: string, status: string, remarks: string | null, at: string) {
  return entry(byId, status, remarks, at)
}
