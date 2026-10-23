import { differenceInCalendarMonths, parseISO } from 'date-fns'

import type {
  LeaveBalance,
  LeaveCoverage,
  LeaveTypeOffer,
  PolicyKind,
} from '@/features/leaves/types/leaves.types'

import { toProfile } from '../attendance/seed'
import { DIRECTORY, type DirectoryEmployee } from '../employees/seed'
import type { StoredStandardRequest } from '../requests/standard/engine'
import { leaveEntitlements, type LeaveStored } from '../requests/standard/kinds/leave'
import { profileOf } from '../scheduling/seed'
import { currentLeaveSettings, leavePolicies, leaveTypes } from './db'
import type { StoredLeaveType } from './seed'

/*
 * What a leave type and the policies decide for a person: how many days they
 * have (their balance) and whether the type is offered to them at all. The
 * requests themselves live in the shared standard requests table, so the
 * numbers agree with Requests → Leave.
 */

export const leaveStored = (record: StoredStandardRequest) =>
  record.payload as unknown as LeaveStored

export const isLeave = (record: StoredStandardRequest) => record.kind === 'leave'

/** Whole months since the person joined. */
export function monthsOfService(employee: DirectoryEmployee): number {
  return Math.max(
    0,
    differenceInCalendarMonths(new Date(), parseISO(toProfile(employee).joiningDate)),
  )
}

/** The directory keeps no marital status: every third person is single. */
export function maritalStatusOf(employee: DirectoryEmployee): 'married' | 'single' {
  const index = DIRECTORY.findIndex((item) => item.id === employee.id)
  return index % 3 === 0 ? 'single' : 'married'
}

/** Balance According to = Experience: the slab the person's service falls in. */
function slabBalance(type: StoredLeaveType, months: number): number | undefined {
  return type.experienceSlabs.find((slab) => months >= slab.minMonths && months <= slab.maxMonths)
    ?.balance
}

/**
 * The person's yearly days of a type: the entitlement Requests → Leave seeds,
 * else the type's own number (or its experience slab). Pro Rated shortens the
 * first year; Earned Balance gives the days month by month.
 */
export function entitlementFor(employee: DirectoryEmployee, type: StoredLeaveType): number {
  const months = monthsOfService(employee)
  const total =
    leaveEntitlements
      .all()
      .find((item) => item.employeeId === employee.id && item.leaveTypeId === type.id)?.days ??
    (type.balanceBasis === 'experience' ? slabBalance(type, months) : undefined) ??
    type.leavesAllowed

  const now = new Date()
  let days = total
  const joined = parseISO(toProfile(employee).joiningDate)
  if (type.proRated && joined.getFullYear() === now.getFullYear()) {
    days = Math.round((days * (12 - joined.getMonth())) / 12)
  }
  if (type.earnedBalance && type.tenure === 'yearly') {
    days = Math.floor((days * (now.getMonth() + 1)) / 12)
  }
  return days
}

/**
 * The person's balance of a type: approved days are Availed (pending ones too
 * when Approve Leave on Status is Pending), pending days are held back from
 * Available. A yearly tenure counts this year's requests; Employment counts
 * them all.
 */
export function leaveBalanceFor(
  employee: DirectoryEmployee,
  type: StoredLeaveType,
  records: readonly StoredStandardRequest[],
  ignoreId: string | null = null,
): LeaveBalance {
  const year = String(new Date().getFullYear())
  let availed = 0
  let pending = 0
  for (const record of records) {
    if (!isLeave(record) || record.id === ignoreId || record.employeeId !== employee.id) continue
    const payload = leaveStored(record)
    if (payload.leaveTypeId !== type.id) continue
    if (type.tenure !== 'employment' && !payload.from.startsWith(year)) continue
    if (record.status === 'completed' || record.status === 'cancelling') availed += payload.count
    if (record.status === 'pending') pending += payload.count
  }
  if (currentLeaveSettings().approveOnStatus === 'pending') {
    availed += pending
    pending = 0
  }
  const total = entitlementFor(employee, type)
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    total,
    availed: round(availed),
    pending: round(pending),
    available: round(total - availed - pending),
  }
}

/**
 * What the person's leave policies allow: a Leave Distribution Policy in
 * force (the company one, or an employee-level one they are enrolled in)
 * lets them apply for leave at all; a Half leave & Short leave policy says
 * whether half days and short leaves may be taken. An employee-level policy
 * of a kind outranks the company one.
 */
export function coverageFor(employee: DirectoryEmployee): LeaveCoverage {
  const applying = leavePolicies
    .all()
    .filter(
      (policy) =>
        policy.active &&
        policy.enforced &&
        (policy.level === 'company' || policy.enrolledIds.includes(employee.id)),
    )
  const pick = (kind: PolicyKind) =>
    applying.find((policy) => policy.kind === kind && policy.level === 'employee') ??
    applying.find((policy) => policy.kind === kind)
  const halfShort = pick('half-short')
  return {
    distribution: pick('distribution') !== undefined,
    halfDay: halfShort?.allowHalfDay ?? false,
    shortLeave: halfShort?.allowShortLeave ?? false,
  }
}

/** Why a type is not offered to the person, or null when it is. */
export function notOfferedBecause(
  employee: DirectoryEmployee,
  type: StoredLeaveType,
): string | null {
  const profile = profileOf(employee)
  if (!type.active) return 'The leave type is not active.'
  if (type.probationType && profile.employmentType !== 'probation') {
    return 'Only people on probation may ask for it.'
  }
  if (!type.applyInProbation && profile.employmentType === 'probation') {
    return 'It cannot be asked for during probation.'
  }
  if (type.gender !== 'any' && type.gender !== profile.gender) {
    return `It is for ${type.gender === 'female' ? 'women' : 'men'}.`
  }
  if (type.maritalStatus !== 'any' && type.maritalStatus !== maritalStatusOf(employee)) {
    return `It is for ${type.maritalStatus} employees.`
  }
  return null
}

/** The types the person may apply for, with their balance of each. */
export function offeredTypes(
  employee: DirectoryEmployee,
  records: readonly StoredStandardRequest[],
): LeaveTypeOffer[] {
  return leaveTypes
    .all()
    .filter((type) => notOfferedBecause(employee, type) === null)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((type) => ({
      id: type.id,
      title: type.title,
      shortCode: type.shortCode,
      attachmentRequired: type.attachmentRequired,
      attachmentRule: type.attachmentRule,
      backDate: type.backDate,
      deductible: type.deductible,
      balance: leaveBalanceFor(employee, type, records),
    }))
}

/** Everyone's balance of every active type, for the lists and the Approve popup. */
export function allBalances(
  records: readonly StoredStandardRequest[],
): Record<string, Record<string, LeaveBalance>> {
  const active = leaveTypes.all().filter((type) => type.active)
  return Object.fromEntries(
    DIRECTORY.map((employee) => [
      employee.id,
      Object.fromEntries(active.map((type) => [type.id, leaveBalanceFor(employee, type, records)])),
    ]),
  )
}
