import { format } from 'date-fns'

import {
  type FlowAuthority,
  type FlowNode,
  type FlowPurpose,
  type FlowScope,
  SETTINGS_REQUEST_TYPE_LABELS,
  type SettingsRequestType,
} from '@/features/requests'

import { createMockCollection } from '../collection'
import type { DirectoryEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'

/*
 * Request Settings as the backend keeps them (one company): restrictions,
 * delegations, versioned approval flows per request type and purpose with a
 * scope, and authority holders. Request types are the API's codes.
 */

const key = (name: string) => `hrms-mock-request-settings-v2-${name}`
const stamp = (date: string) => `${date}T09:00:00.000Z`

/** The company every mock record belongs to. */
export const COMPANY_NAME = 'Top Edge Technologies'

/** A department's id as the mock's look-ups give it (`mockDepartmentId` in ./backend). */
const departmentIdOf = (name: string) => `dep_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** The mock's row version: the record's last change. */
export const versionOf = (record: { createdAt: string; updatedAt: string | null }) =>
  record.updatedAt ?? record.createdAt

// --- Request Restriction -----------------------------------------------------------------------

export interface StoredRestriction {
  id: string
  requestType: SettingsRequestType
  startDate: string
  endDate: string
  description: string | null
  createdAt: string
  updatedAt: string | null
}

function seedRestrictions(): StoredRestriction[] {
  const year = new Date().getFullYear()
  return [
    {
      id: 'rr_1',
      requestType: 'leave',
      startDate: '2023-12-15',
      endDate: '2023-12-18',
      description: 'Year-end closing.',
      createdAt: stamp('2023-12-01'),
      updatedAt: null,
    },
    {
      id: 'rr_2',
      requestType: 'overtime',
      startDate: `${String(year)}-12-24`,
      endDate: `${String(year)}-12-31`,
      description: 'Office closed for the holidays.',
      createdAt: stamp(`${String(year)}-01-05`),
      updatedAt: null,
    },
  ]
}

export const requestRestrictions = createMockCollection<StoredRestriction>({
  storageKey: key('restrictions'),
  seed: seedRestrictions,
})

const longDate = (date: string) => format(new Date(`${date}T00:00`), 'MMMM d, yyyy')

/**
 * Why a request of this type cannot be made for the date, or null: a
 * restriction of the type covers it (`REQUEST_RESTRICTED`). Accepts the API's
 * type code (`leave`); the person is kept for the old call shape.
 */
export function restrictionFor(
  type: string,
  date: string,
  _employeeId: string = CURRENT_EMPLOYEE_ID,
): string | null {
  const hit = requestRestrictions
    .all()
    .find((item) => item.requestType === type && item.startDate <= date && item.endDate >= date)
  if (!hit) return null
  const label = SETTINGS_REQUEST_TYPE_LABELS[hit.requestType].replace(/ Request$/, '')
  return `${label} requests are closed from ${longDate(hit.startDate)} to ${longDate(hit.endDate)}.`
}

// --- Delegation --------------------------------------------------------------------------------

export interface StoredDelegation {
  id: string
  delegatorId: string
  delegateeId: string
  requestType: SettingsRequestType
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

function seedDelegations(): StoredDelegation[] {
  const delegation = (
    id: string,
    delegatorId: string,
    delegateeId: string,
    requestType: SettingsRequestType,
    isActive: boolean,
    description: string,
  ): StoredDelegation => ({
    id,
    delegatorId,
    delegateeId,
    requestType,
    description,
    isActive,
    createdAt: stamp('2026-09-01'),
    updatedAt: null,
  })
  // Bilal Ahmed is away: the HR manager approves his team's requests (Approvals → Delegates).
  const away = [
    'punch',
    'shift_swap',
    'transfer',
    'leave',
    'loan',
    'work_from_home',
    'promotion',
    'relaxation',
    'rest_day',
    'travel',
    'resignation',
  ] as const
  return [
    ...away.map((type, index) =>
      delegation(
        `dl_${String(index + 1)}`,
        'em_bilal',
        CURRENT_EMPLOYEE_ID,
        type,
        true,
        'While on annual leave.',
      ),
    ),
    delegation('dl_20', 'em_ayesha', 'em_hina', 'leave', false, 'Covered during the audit.'),
  ]
}

export const requestDelegations = createMockCollection<StoredDelegation>({
  storageKey: key('delegations'),
  seed: seedDelegations,
})

/** Whose approvals the person takes over: active delegations to them (of one type code, if given). */
export function activeDelegatorsOf(personId: string, type?: string): string[] {
  const ids = requestDelegations
    .all()
    .filter(
      (item) =>
        item.isActive && item.delegateeId === personId && (!type || item.requestType === type),
    )
    .map((item) => item.delegatorId)
  return [...new Set(ids)]
}

// --- Request Flows -----------------------------------------------------------------------------

export interface StoredFlowNode extends FlowNode {
  id: string
}

/** One version of a flow; saving a flow keeps the old version (`isCurrent: false`). */
export interface StoredFlow {
  id: string
  requestType: SettingsRequestType
  purpose: FlowPurpose
  name: string
  scopeType: FlowScope
  scopeId: string | null
  description: string | null
  isActive: boolean
  isCurrent: boolean
  nodes: StoredFlowNode[]
  createdAt: string
  updatedAt: string | null
}

const node = (
  flowId: string,
  stepNo: number,
  approverKind: FlowNode['approverKind'],
  extra: Partial<FlowNode> = {},
): StoredFlowNode => ({
  id: `${flowId}_n${String(stepNo)}`,
  stepNo,
  approverKind,
  employeeId: null,
  roleId: null,
  isCondition: false,
  expression: null,
  next: null,
  ifTrue: null,
  ifFalse: null,
  canEdit: false,
  canDisagree: false,
  isObserver: false,
  ...extra,
})

/** "General Flow": the line manager, then the final authority. */
export function generalFlowNodes(flowId: string): StoredFlowNode[] {
  return [node(flowId, 1, 'line_manager'), node(flowId, 2, 'final_authority')]
}

function seedFlows(): StoredFlow[] {
  const flow = (
    id: string,
    requestType: SettingsRequestType,
    scopeType: FlowScope,
    scopeId: string | null,
    name: string,
    nodes: StoredFlowNode[],
    description: string | null = null,
  ): StoredFlow => ({
    id,
    requestType,
    purpose: 'request',
    name,
    scopeType,
    scopeId,
    description,
    isActive: true,
    isCurrent: true,
    nodes,
    createdAt: stamp('2026-09-01'),
    updatedAt: null,
  })
  return [
    flow(
      'fl_punch',
      'punch',
      'company',
      null,
      'General Flow',
      generalFlowNodes('fl_punch'),
      'Line Manager, then Final Authority. Added automatically; edit it under Request Settings.',
    ),
    // Two people whose leave goes through a set chain (the old Request Flow assignments).
    flow('fl_saad_leave', 'leave', 'employee', 'em_saad', 'Saad Hadier leave', [
      node('fl_saad_leave', 1, 'line_manager'),
      node('fl_saad_leave', 2, 'hod'),
      node('fl_saad_leave', 3, 'final_authority'),
    ]),
    flow('fl_zainab_leave', 'leave', 'employee', 'em_zainab', 'Zainab Noor leave', [
      node('fl_zainab_leave', 1, 'line_manager'),
      node('fl_zainab_leave', 2, 'final_authority'),
    ]),
  ]
}

export const requestFlows = createMockCollection<StoredFlow>({
  storageKey: key('flows'),
  seed: seedFlows,
})

/** `leave-cancel` → leave, cancellation. */
export function splitType(type: string): {
  requestType: string
  purpose: FlowPurpose
} {
  return type.endsWith('-cancel')
    ? { requestType: type.slice(0, -'-cancel'.length), purpose: 'cancellation' }
    : { requestType: type, purpose: 'request' }
}

/**
 * The flow a person's request of a type walks: the most specific active
 * current one (employee, department, branch, company); a cancellation
 * without its own flow walks the request flow; none at all: the General Flow.
 */
export function flowFor(employee: DirectoryEmployee, type: string): FlowNode[] {
  const { requestType, purpose } = splitType(type)
  const find = (wanted: FlowPurpose) => {
    const flows = requestFlows
      .all()
      .filter(
        (item) =>
          item.isCurrent &&
          item.isActive &&
          item.requestType === requestType &&
          item.purpose === wanted,
      )
    return (
      flows.find((item) => item.scopeType === 'employee' && item.scopeId === employee.id) ??
      flows.find(
        (item) =>
          item.scopeType === 'department' && item.scopeId === departmentIdOf(employee.department),
      ) ??
      flows.find((item) => item.scopeType === 'branch' && item.scopeId === employee.branchId) ??
      flows.find((item) => item.scopeType === 'company')
    )
  }
  const chosen = find(purpose) ?? (purpose === 'cancellation' ? find('request') : undefined)
  return [...(chosen?.nodes ?? generalFlowNodes('general'))].sort((a, b) => a.stepNo - b.stepNo)
}

// --- Authorities -------------------------------------------------------------------------------

export interface StoredAuthority {
  id: string
  authority: FlowAuthority
  employeeId: string
  requestType: SettingsRequestType | null
  branchId: string | null
  departmentId: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

function seedAuthorities(): StoredAuthority[] {
  const holder = (
    id: string,
    authority: FlowAuthority,
    employeeId: string,
    branchId: string | null = null,
  ): StoredAuthority => ({
    id,
    authority,
    employeeId,
    requestType: null,
    branchId,
    departmentId: null,
    description: null,
    isActive: true,
    createdAt: stamp('2026-09-01'),
    updatedAt: null,
  })
  return [
    holder('au_1', 'finance_manager', 'em_hina'),
    holder('au_2', 'it_administrator', 'em_omar', 'br_isb'),
  ]
}

export const requestAuthorities = createMockCollection<StoredAuthority>({
  storageKey: key('authorities'),
  seed: seedAuthorities,
})

/**
 * Who holds an authority for a person's request of a type: the active holder
 * matching the type, branch and department (empty matches all), the most
 * specific first; null when nobody does.
 */
export function authorityHolder(
  authority: FlowAuthority,
  employee: DirectoryEmployee,
  type: string,
): string | null {
  const { requestType } = splitType(type)
  const department = departmentIdOf(employee.department)
  const matches = requestAuthorities
    .all()
    .filter(
      (item) =>
        item.isActive &&
        item.authority === authority &&
        (item.requestType === null || item.requestType === requestType) &&
        (item.branchId === null || item.branchId === employee.branchId) &&
        (item.departmentId === null || item.departmentId === department),
    )
  const weight = (item: StoredAuthority) =>
    Number(item.requestType !== null) +
    Number(item.branchId !== null) +
    Number(item.departmentId !== null)
  return matches.sort((a, b) => weight(b) - weight(a))[0]?.employeeId ?? null
}

export function resetRequestSettingsDb(): void {
  requestRestrictions.reset()
  requestDelegations.reset()
  requestFlows.reset()
  requestAuthorities.reset()
}
