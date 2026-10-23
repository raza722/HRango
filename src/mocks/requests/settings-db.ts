import { format } from 'date-fns'

import {
  type FlowAuthority,
  type FlowNode,
  type FlowRequestType,
  type RequestDelegation,
  type RequestFlowDefinition,
  type RequestRestriction,
  SETTINGS_REQUEST_TYPE_LABELS,
  type SettingsRequestType,
} from '@/features/requests'

import { createMockCollection } from '../collection'
import { findEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'
import { branches } from '../settings/handlers'

const key = (name: string) => `hrms-mock-request-settings-${name}`
const stamp = (date: string) => `${date}T09:00:00.000Z`

/** The company a restriction belongs to when the person has no branch on file. */
export const DEFAULT_COMPANY_ID = 'co_topedge'

// --- Request Restriction -----------------------------------------------------------------------

function seedRestrictions(): RequestRestriction[] {
  const year = new Date().getFullYear()
  return [
    {
      id: 'rr_1',
      companyId: DEFAULT_COMPANY_ID,
      requestType: 'leave',
      startDate: '2023-12-15',
      endDate: '2023-12-18',
      description: 'Year-end closing.',
      createdAt: stamp('2023-12-01'),
    },
    {
      id: 'rr_2',
      companyId: DEFAULT_COMPANY_ID,
      requestType: 'overtime',
      startDate: `${String(year)}-12-24`,
      endDate: `${String(year)}-12-31`,
      description: 'Office closed for the holidays.',
      createdAt: stamp(`${String(year)}-01-05`),
    },
  ]
}

export const requestRestrictions = createMockCollection<RequestRestriction>({
  storageKey: key('restrictions'),
  seed: seedRestrictions,
})

/** The company of the person's branch. */
export function companyOf(employeeId: string): string {
  const branchId = findEmployee(employeeId)?.branchId
  return (branchId ? branches.find(branchId)?.companyId : undefined) ?? DEFAULT_COMPANY_ID
}

const longDate = (date: string) => format(new Date(`${date}T00:00`), 'MMMM d, yyyy')

/**
 * Why a request of this type cannot be made for the date, or null: an
 * active restriction of the person's company covers it.
 */
export function restrictionFor(
  type: SettingsRequestType,
  date: string,
  employeeId: string = CURRENT_EMPLOYEE_ID,
): string | null {
  const company = companyOf(employeeId)
  const hit = requestRestrictions
    .all()
    .find(
      (item) =>
        item.requestType === type &&
        item.companyId === company &&
        item.startDate <= date &&
        item.endDate >= date,
    )
  if (!hit) return null
  const name = SETTINGS_REQUEST_TYPE_LABELS[type].replace(/ Request$/, '')
  return `${name} requests are closed from ${longDate(hit.startDate)} to ${longDate(hit.endDate)}.`
}

// --- Delegation --------------------------------------------------------------------------------

function seedDelegations(): RequestDelegation[] {
  const delegation = (
    id: string,
    delegatorId: string,
    delegateeId: string,
    requestType: SettingsRequestType,
    active: boolean,
    description: string,
  ): RequestDelegation => ({
    id,
    delegatorId,
    delegateeId,
    requestType,
    description,
    active,
    createdAt: stamp('2026-09-01'),
  })
  // Bilal Ahmed is away: the HR manager approves his team's requests (Approvals → Delegates).
  return [
    delegation('dl_1', 'em_bilal', CURRENT_EMPLOYEE_ID, 'punch', true, 'While on annual leave.'),
    delegation('dl_2', 'em_bilal', CURRENT_EMPLOYEE_ID, 'shift', true, 'While on annual leave.'),
    delegation('dl_3', 'em_bilal', CURRENT_EMPLOYEE_ID, 'transfer', true, 'While on annual leave.'),
    delegation('dl_4', 'em_ayesha', 'em_hina', 'leave', false, 'Covered during the audit.'),
    // The standard request types (Requests section 2697:5532) get the same delegation.
    ...(
      [
        'leave',
        'lend',
        'work-from-home',
        'promotion',
        'relaxation',
        'rest-day',
        'travel',
        'resignation',
      ] as const
    ).map((type, index) =>
      delegation(
        `dl_${String(index + 5)}`,
        'em_bilal',
        CURRENT_EMPLOYEE_ID,
        type,
        true,
        'While on annual leave.',
      ),
    ),
  ]
}

export const requestDelegations = createMockCollection<RequestDelegation>({
  storageKey: key('delegations'),
  seed: seedDelegations,
})

/** Whose approvals the person takes over: active delegations to them (of one type, if given). */
export function activeDelegatorsOf(personId: string, type?: string): string[] {
  const ids = requestDelegations
    .all()
    .filter(
      (item) =>
        item.active && item.delegateeId === personId && (!type || item.requestType === type),
    )
    .map((item) => item.delegatorId)
  return [...new Set(ids)]
}

// --- Request Flows -----------------------------------------------------------------------------

const node = (id: number, type: FlowNode['node'], next: number | null): FlowNode => ({
  id,
  canEdit: true,
  onLooker: false,
  canDisagree: false,
  isCondition: false,
  node: type,
  employeeId: null,
  next,
  expression: '',
  ifTrue: null,
  ifFalse: null,
})

/**
 * "General Flow": the line manager, then the final authority (the HR
 * manager). A cancellation goes to the final authority alone.
 */
export function generalFlow(type: FlowRequestType): RequestFlowDefinition {
  return {
    requestType: type,
    name: 'General Flow',
    nodes: type.endsWith('-cancel')
      ? [node(1, 'final-authority', null)]
      : [node(1, 'line-manager', 2), node(2, 'final-authority', null)],
  }
}

/** Flows changed in Request Flow Edit; the rest follow the General Flow. */
export const requestFlows = createMockCollection<RequestFlowDefinition & { id: string }>({
  storageKey: key('flows'),
  seed: () => [],
})

export function flowDefinition(type: FlowRequestType): RequestFlowDefinition {
  const stored = requestFlows.find(type)
  if (!stored) return generalFlow(type)
  return { requestType: stored.requestType, name: stored.name, nodes: stored.nodes }
}

export interface FlowAssignment {
  id: string
  employeeId: string
  requestType: FlowRequestType
  authorities: FlowAuthority[]
}

/** Two people whose leave goes through a set chain of authorities (Request Flow page). */
function seedAssignments(): FlowAssignment[] {
  return [
    {
      id: 'fa_em_saad_leave',
      employeeId: 'em_saad',
      requestType: 'leave',
      authorities: ['line-manager', 'hod', 'final-authority'],
    },
    {
      id: 'fa_em_zainab_leave',
      employeeId: 'em_zainab',
      requestType: 'leave',
      authorities: ['line-manager', 'final-authority'],
    },
  ]
}

export const flowAssignments = createMockCollection<FlowAssignment>({
  storageKey: key('flow-assignments'),
  seed: seedAssignments,
})

export const assignmentId = (employeeId: string, type: FlowRequestType) =>
  `fa_${employeeId}_${type}`

/** The person's chain of authorities for a request type; General Flow when none is set. */
export function authoritiesOf(employeeId: string, type: FlowRequestType): FlowAuthority[] {
  return flowAssignments.find(assignmentId(employeeId, type))?.authorities ?? ['general-flow']
}

export function resetRequestSettingsDb(): void {
  requestRestrictions.reset()
  requestDelegations.reset()
  requestFlows.reset()
  flowAssignments.reset()
}
