import { differenceInCalendarMonths, parseISO } from 'date-fns'

import type {
  LeaveApplication,
  LeaveBalance,
  LeaveBalanceRow,
  LeavePolicy,
  LeaveRequestDetail,
  LeaveType,
} from '@/features/leaves/types/leaves.types'

import { createId } from '../utils'
import { leaveLedger, leavePolicies, leaveRequests, leaveTypeStore } from './db'
import {
  MOCK_PEOPLE,
  MOCK_SELF_ID,
  type MockPerson,
  type StoredLeavePolicy,
  type StoredLeaveRequest,
  type StoredLeaveType,
  thisYear,
} from './seed'

/*
 * The backend's leave rules, simplified for the mock (comparison/05-leaves-and-warning.md,
 * "Decisions"): the leave year is the calendar year; a person's leave types come from their
 * distribution policy (an employee-level enrolment outranks the company-level one); balances
 * are the ledger's credits less approved and pending requests.
 */

export const personOf = (id: string) => MOCK_PEOPLE.find((person) => person.id === id)

const CREDIT_REASONS = new Set([
  'opening',
  'allotment',
  'earned',
  'carry_forward',
  'adjustment',
  'overtime',
])

/** Ledger rows, requests and policies using the type. */
export function inUseCount(typeId: string): number {
  return (
    leaveLedger.all().filter((row) => row.leaveTypeId === typeId).length +
    leaveRequests.all().filter((row) => row.leaveTypeId === typeId).length +
    leavePolicies.all().filter((policy) => policy.types.some((row) => row.leaveTypeId === typeId))
      .length
  )
}

export const typeOut = (type: StoredLeaveType): LeaveType => ({
  ...type,
  inUse: inUseCount(type.id),
})

export function policyOut(policy: StoredLeavePolicy): LeavePolicy {
  const types = policy.types.map((row) => {
    const type = leaveTypeStore.find(row.leaveTypeId)
    return {
      leaveTypeId: row.leaveTypeId,
      leaveTypeTitle: type?.title ?? '—',
      shortCode: type?.shortCode ?? null,
      allowance: row.allowance,
      effectiveAllowance: row.allowance ?? type?.allowance ?? null,
    }
  })
  const { enrolled, ...rest } = policy
  return {
    ...rest,
    types,
    totalLeaves:
      policy.policyKind === 'distribution'
        ? types.reduce((sum, row) => sum + (row.effectiveAllowance ?? 0), 0)
        : null,
    enrolledCount:
      policy.policyLevel === 'company'
        ? MOCK_PEOPLE.filter((person) => person.status === 'active').length
        : enrolled.length,
  }
}

/** The active policy of a kind covering the person: their enrolment first, else the company's. */
export function policyFor(employeeId: string, kind: 'distribution' | 'half_short') {
  const active = leavePolicies
    .all()
    .filter((policy) => policy.isActive && policy.policyKind === kind)
  return (
    active.find(
      (policy) =>
        policy.policyLevel === 'employee' &&
        policy.enrolled.some((row) => row.employeeId === employeeId),
    ) ?? active.find((policy) => policy.policyLevel === 'company')
  )
}

/** The person's leave types with the allowance their policy gives (every active type without one). */
export function coveredTypes(employeeId: string): { type: StoredLeaveType; allowance: number }[] {
  const policy = policyFor(employeeId, 'distribution')
  const anyDistribution = leavePolicies
    .all()
    .some((item) => item.isActive && item.policyKind === 'distribution')
  const active = leaveTypeStore.all().filter((type) => type.isActive)
  if (!policy) {
    return anyDistribution ? [] : active.map((type) => ({ type, allowance: type.allowance ?? 0 }))
  }
  return policy.types.flatMap((row) => {
    const type = active.find((item) => item.id === row.leaveTypeId)
    return type ? [{ type, allowance: row.allowance ?? type.allowance ?? 0 }] : []
  })
}

/** Months served at the year start. */
const monthsServed = (person: MockPerson, year: number) =>
  Math.max(0, differenceInCalendarMonths(new Date(year, 0, 1), parseISO(person.joiningDate)))

/** A year's entitlement: the allowance (×12 monthly) or the experience slab. */
export function entitlement(
  person: MockPerson,
  type: StoredLeaveType,
  allowance: number,
  year: number,
) {
  if (type.balanceBasis === 'experience') {
    const months = monthsServed(person, year)
    const slab = type.experienceSlabs.find(
      (item) => months >= item.minMonths && (item.maxMonths === null || months <= item.maxMonths),
    )
    return slab?.balance ?? 0
  }
  return type.tenure === 'monthly' ? allowance * 12 : allowance
}

const eligible = (person: MockPerson, type: StoredLeaveType) =>
  (type.gender === 'any' || type.gender === person.gender) &&
  (type.maritalStatus === 'any' || type.maritalStatus === person.maritalStatus)

/** `POST /leaves/allotment/process`: idempotent, one allotment row per person, type and year. */
export function runAllotment(year: number, leaveTypeId?: string, employeeId?: string) {
  let allotted = 0
  let days = 0
  for (const person of MOCK_PEOPLE) {
    if (person.status !== 'active' || (employeeId && person.id !== employeeId)) continue
    for (const { type, allowance } of coveredTypes(person.id)) {
      if (leaveTypeId ? type.id !== leaveTypeId : !type.autoAllotment) continue
      if (!type.isDeductible || !eligible(person, type)) continue
      const exists = leaveLedger
        .all()
        .some(
          (row) =>
            row.employeeId === person.id &&
            row.leaveTypeId === type.id &&
            row.fiscalYear === year &&
            row.reason === 'allotment',
        )
      if (exists) continue
      const amount = entitlement(person, type, allowance, year)
      leaveLedger.insert({
        id: createId('ll'),
        employeeId: person.id,
        leaveTypeId: type.id,
        fiscalYear: year,
        entryDate: `${String(year)}-01-01`,
        days: amount,
        reason: 'allotment',
        remarks: null,
        leaveEncashmentId: null,
        createdAt: new Date().toISOString(),
      })
      allotted += 1
      days += amount
    }
  }
  return { fiscalYear: year, allotted, earned: 0, days }
}

const yearOf = (date: string) => Number(date.slice(0, 4))

/** `lv.fn_leave_balance`: credits less used (approved, cancelling, encashed) and pending days. */
export function balanceOf(employeeId: string, leaveTypeId: string, year: number): LeaveBalance {
  const ledger = leaveLedger
    .all()
    .filter(
      (row) =>
        row.employeeId === employeeId && row.leaveTypeId === leaveTypeId && row.fiscalYear === year,
    )
  const entitled = ledger
    .filter((row) => CREDIT_REASONS.has(row.reason))
    .reduce((sum, row) => sum + row.days, 0)
  const debits = ledger
    .filter((row) => !CREDIT_REASONS.has(row.reason))
    .reduce((sum, row) => sum - row.days, 0)
  const requests = leaveRequests
    .all()
    .filter(
      (row) =>
        row.employeeId === employeeId &&
        row.leaveTypeId === leaveTypeId &&
        yearOf(row.fromDate) === year,
    )
  const daysWhere = (statuses: string[]) =>
    requests.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row.days, 0)
  const used = daysWhere(['approved', 'cancelling']) + debits
  const pending = daysWhere(['pending'])
  return { entitled, used, pending, available: entitled - used - pending }
}

/** The balance rows of `GET /leaves/balances`: each person's types with a ledger row or a request. */
export function balanceRows(year: number): LeaveBalanceRow[] {
  const rows: LeaveBalanceRow[] = []
  for (const person of MOCK_PEOPLE) {
    const typeIds = new Set([
      ...leaveLedger
        .all()
        .filter((row) => row.employeeId === person.id && row.fiscalYear === year)
        .map((row) => row.leaveTypeId),
      ...leaveRequests
        .all()
        .filter((row) => row.employeeId === person.id && yearOf(row.fromDate) === year)
        .map((row) => row.leaveTypeId),
    ])
    for (const typeId of typeIds) {
      const type = leaveTypeStore.find(typeId)
      if (!type) continue
      rows.push({
        employeeId: person.id,
        employeeCode: person.code,
        employeeName: person.name,
        departmentName: person.departmentName,
        leaveTypeId: type.id,
        leaveTypeTitle: type.title,
        shortCode: type.shortCode,
        fiscalYear: year,
        ...balanceOf(person.id, type.id, year),
      })
    }
  }
  return rows
}

export function applicationOut(row: StoredLeaveRequest): LeaveApplication {
  const person = personOf(row.employeeId)
  const type = leaveTypeStore.find(row.leaveTypeId)
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    employeeId: row.employeeId,
    employeeCode: person?.code ?? '',
    employeeName: person?.name ?? '—',
    departmentId: person?.departmentId ?? null,
    departmentName: person?.departmentName ?? null,
    leaveTypeId: row.leaveTypeId,
    leaveTypeTitle: type?.title ?? '—',
    leaveTypeCode: type?.shortCode ?? null,
    fromDate: row.fromDate,
    toDate: row.toDate,
    days: row.days,
    isShort: row.isShort,
    shortLeaveType: row.shortLeaveType,
    startTime: row.startTime,
    endTime: row.endTime,
    reason: row.reason,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
  }
}

/** Whether the person is one of the signed-in person's reports (direct or indirect). */
export function isSubordinate(employeeId: string): boolean {
  let manager = personOf(employeeId)?.lineManagerId ?? null
  const seen = new Set<string>()
  while (manager && !seen.has(manager)) {
    if (manager === MOCK_SELF_ID) return true
    seen.add(manager)
    manager = personOf(manager)?.lineManagerId ?? null
  }
  return false
}

/**
 * `GET /requests/leave/{id}` as the mock answers it: the signed-in person may cancel their own
 * pending or approved leave, and decides everyone else's (the mock's approver for all).
 */
export function requestDetailOut(row: StoredLeaveRequest): LeaveRequestDetail {
  const own = row.employeeId === MOCK_SELF_ID
  const actions = ['view']
  if (own && row.status === 'pending') actions.push('edit', 'delete', 'cancel')
  if (own && row.status === 'approved') actions.push('cancel')
  if (!own && (row.status === 'pending' || row.status === 'cancelling')) {
    actions.push('approve', 'reject')
  }
  const waiting = row.status === 'pending' || row.status === 'cancelling'
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    employeeId: row.employeeId,
    employeeName: personOf(row.employeeId)?.name ?? null,
    nextApproverName: waiting ? 'Shelley Kannes' : null,
    nextApproverKind: waiting ? 'line_manager' : null,
    finalAuthorityName: 'Shelley Kannes',
    rowVersion: row.rowVersion,
    steps: row.steps,
    attachments: row.attachments,
    actions,
  }
}

/** The current leave year's balances exist once the seed is allotted. */
export function allotSeed(): void {
  if (leaveLedger.all().length === 0) runAllotment(thisYear())
}

/**
 * Compatibility for `src/mocks/requests` (Requests → Leave): a person's yearly days of a type,
 * from their policy and the type's balance settings.
 */
export function entitlementFor(employee: { id: string }, type: { id: string }): number {
  const person = personOf(employee.id)
  const covered = coveredTypes(employee.id).find((item) => item.type.id === type.id)
  const stored = leaveTypeStore.find(type.id)
  if (!stored) return 0
  if (!person) return stored.allowance ?? 0
  return entitlement(person, stored, covered?.allowance ?? stored.allowance ?? 0, thisYear())
}
