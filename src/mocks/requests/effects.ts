import { addDays, format, parse } from 'date-fns'

import type { ScheduleEntry } from '@/features/scheduling'
import { weekdayOf } from '@/features/scheduling'

import { attendancePunches } from '../attendance/db'
import { computeRange, takeSnapshot } from '../attendance/engine'
import { rosterGroups } from '../roster/handlers'
import { scheduleEntries } from '../scheduling/handlers'
import { slotFor } from '../scheduling/seed'
import { createId } from '../utils'
import { employeeTransfers, transferLogOf } from './db'
import type { AppliedEffect, StoredPunchRequest, StoredRequest, StoredShiftRequest } from './flow'
import type { StoredTransferRequest } from './transfer-flow'

const ROSTER_DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const

export function entryOn(employeeId: string, date: string): ScheduleEntry | undefined {
  return scheduleEntries.all().find((item) => item.employeeId === employeeId && item.date === date)
}

/** The roster's clock in / out on a date, or null when the roster has that day off. */
export function rosterTimes(rosterGroupId: string, date: string) {
  const group = rosterGroups.find(rosterGroupId)
  const day = group?.days[ROSTER_DAY_INDEX[weekdayOf(date)]]
  if (!group || !day || day.isWeekend || !day.clockIn || !day.clockOut) return null
  return { group, clockIn: day.clockIn, clockOut: day.clockOut }
}

/**
 * An approved punch request becomes a punch in Attendance. "Missing Punch"
 * fills whichever punch the day lacks, check in first.
 */
function applyPunch(record: StoredPunchRequest): AppliedEffect {
  const { date, punchTime } = record.payload
  let type: 'check-in' | 'check-out' =
    record.payload.punchType === 'check-out' ? 'check-out' : 'check-in'
  const entry = entryOn(record.employeeId, date)
  if (record.payload.punchType === 'missing-punch') {
    const day = computeRange(takeSnapshot(), record.employeeId, date, date)[0]?.day
    type = day?.checkIn ? 'check-out' : 'check-in'
  }
  // An overnight shift's check out is the next morning.
  const overnight =
    type === 'check-out' && entry?.clockIn && entry.clockOut
      ? entry.clockOut < entry.clockIn && punchTime < entry.clockIn
      : false
  const punchDate = overnight
    ? format(addDays(parse(date, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd')
    : date
  const punchId = createId('pl')
  attendancePunches.insert({
    id: punchId,
    employeeId: record.employeeId,
    date,
    type,
    at: `${punchDate}T${punchTime}`,
    description: `Punch request ${record.code}${record.payload.description ? `: ${record.payload.description}` : ''}`,
    source: 'request',
    machineId: null,
    manuallyUpdated: true,
  })
  return { type: 'punch', punchId }
}

function writeEntry(
  employeeId: string,
  date: string,
  next: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const now = new Date().toISOString()
  const existing = entryOn(employeeId, date)
  if (existing) scheduleEntries.update(existing.id, { ...existing, ...next, updatedAt: now })
  else scheduleEntries.insert({ ...next, id: createId('se'), createdAt: now, updatedAt: now })
}

/** An approved shift request changes the schedule: a new roster, or a swap. */
function applyShift(record: StoredShiftRequest): AppliedEffect {
  const { date, rosterGroupId, swapWithId } = record.payload
  const mine = entryOn(record.employeeId, date) ?? null
  if (swapWithId) {
    const theirs = entryOn(swapWithId, date) ?? null
    const before = [
      { employeeId: record.employeeId, entry: mine },
      { employeeId: swapWithId, entry: theirs },
    ]
    const take = (from: ScheduleEntry | null, employeeId: string) => {
      if (!from) {
        const existing = entryOn(employeeId, date)
        if (existing) scheduleEntries.remove(existing.id)
        return
      }
      const { id: _id, createdAt: _created, updatedAt: _updated, ...rest } = from
      writeEntry(employeeId, date, { ...rest, employeeId, batchId: record.code })
    }
    take(theirs, record.employeeId)
    take(mine, swapWithId)
    return { type: 'schedule', before }
  }
  const times = rosterGroupId ? rosterTimes(rosterGroupId, date) : null
  if (times) {
    writeEntry(record.employeeId, date, {
      employeeId: record.employeeId,
      date,
      kind: 'shift',
      rosterGroupId: times.group.id,
      clockIn: times.clockIn,
      clockOut: times.clockOut,
      workFromHome: mine?.workFromHome ?? false,
      geoFenceIds: mine?.geoFenceIds ?? [],
      breaks: mine?.breaks ?? [],
      slot: slotFor(times.group, times.clockOut < times.clockIn),
      restDayPayable: false,
      batchId: record.code,
    })
  }
  return { type: 'schedule', before: [{ employeeId: record.employeeId, entry: mine }] }
}

export function applyEffect(record: StoredRequest): AppliedEffect {
  return record.kind === 'punch' ? applyPunch(record) : applyShift(record)
}

/**
 * An approved transfer is recorded in the transfer log for the employee's
 * records. The directory itself (branch, department, manager) is not changed:
 * the other mock modules read it as seeded.
 */
export function applyTransfer(record: StoredTransferRequest): void {
  revertTransfer(record.id)
  employeeTransfers.insert(transferLogOf(record, new Date().toISOString()))
}

/** An approved cancellation takes the transfer out of the log again. */
export function revertTransfer(requestId: string): void {
  for (const entry of employeeTransfers.all()) {
    if (entry.requestId === requestId) employeeTransfers.remove(entry.id)
  }
}

/** Puts back what an approval changed (after an approved cancellation). */
export function revertEffect(effect: AppliedEffect | null, date: string): void {
  if (!effect) return
  if (effect.type === 'punch') {
    attendancePunches.remove(effect.punchId)
    return
  }
  for (const { employeeId, entry } of effect.before) {
    const current = entryOn(employeeId, date)
    if (entry) {
      if (current) scheduleEntries.update(current.id, { ...entry, id: current.id })
      else scheduleEntries.insert(entry)
    } else if (current) {
      scheduleEntries.remove(current.id)
    }
  }
}
