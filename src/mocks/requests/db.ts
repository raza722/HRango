import { addDays, format, subDays } from 'date-fns'

import { transferLetter } from '@/features/requests'

import { createMockCollection } from '../collection'
import { rosterGroups } from '../roster/handlers'
import { scheduleEntries } from '../scheduling/handlers'
import { branches, locations } from '../settings/handlers'
import {
  applyCancelRequest,
  applyConsent,
  applyDecision,
  newRecord,
  type StoredPunchRequest,
  type StoredShiftRequest,
} from './flow'
import { ME, mustFind, ref } from './people'
import { decideTransfer, newTransferRecord, type StoredTransferRequest } from './transfer-flow'

/** The shift a person has on a date, as "Morning Work (09:00 AM – 05:00 PM)". */
export function shiftText(employeeId: string, date: string): string | null {
  const entry = scheduleEntries
    .all()
    .find((item) => item.employeeId === employeeId && item.date === date)
  if (!entry) return null
  if (entry.kind === 'rest' || !entry.clockIn || !entry.clockOut) return 'Rest Day'
  const clock = (time: string) => format(new Date(`2000-01-01T${time}`), 'hh:mm a')
  return `${entry.slot.name} (${clock(entry.clockIn)} – ${clock(entry.clockOut)})`
}

function shiftDay(employeeId: string, step: -1 | 1, skip: number, weekdaysOnly = false) {
  let day = new Date()
  let left = skip
  for (let guard = 0; guard < 60; guard += 1) {
    day = step < 0 ? subDays(day, 1) : addDays(day, 1)
    const date = format(day, 'yyyy-MM-dd')
    const entry = scheduleEntries
      .all()
      .find((item) => item.employeeId === employeeId && item.date === date && item.kind === 'shift')
    const weekend = day.getDay() === 0 || day.getDay() === 6
    if (entry?.clockIn && entry.clockOut && !(weekdaysOnly && weekend)) {
      if (left === 0) return { date, clockIn: entry.clockIn, clockOut: entry.clockOut }
      left -= 1
    }
  }
  const date = format(step < 0 ? subDays(new Date(), 2) : addDays(new Date(), 2), 'yyyy-MM-dd')
  return { date, clockIn: '09:00', clockOut: '17:00' }
}

/** The `skip`-th past day on which the person had a shift. */
const pastShift = (employeeId: string, skip = 0) => shiftDay(employeeId, -1, skip)
/** The `skip`-th coming day with a shift. */
const nextShift = (employeeId: string, skip = 0) => shiftDay(employeeId, 1, skip)
/** A coming Monday–Friday shift, so a Morning Work or Flexible roster can take it. */
const nextWeekdayShift = (employeeId: string, skip = 0) => shiftDay(employeeId, 1, skip, true)

const daysAgo = (days: number, hour = 10) => {
  const date = subDays(new Date(), days)
  date.setHours(hour, 15, 0, 0)
  return date.toISOString()
}

const plus = (time: string, minutes: number) => {
  const [hours = 0, mins = 0] = time.split(':').map(Number)
  const total = (hours * 60 + mins + minutes + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function punch(
  number: number,
  employeeId: string,
  type: StoredPunchRequest['payload']['punchType'],
  day: { date: string; clockIn: string; clockOut: string },
  description: string,
  createdDaysAgo: number,
  consents: string[] = [],
): StoredPunchRequest {
  const punchTime = type === 'check-out' ? plus(day.clockOut, 6) : plus(day.clockIn, 4)
  return newRecord<StoredPunchRequest>(
    {
      id: `prq_${number}`,
      code: `RQ-ATT-${String(880 + number).padStart(4, '0')}`,
      kind: 'punch',
      employeeId,
      createdById: employeeId,
      consents: consents.map((personId) => ({ personId, status: 'pending', remarks: null })),
      payload: { date: day.date, punchType: type, punchTime, description },
    },
    daysAgo(createdDaysAgo),
  )
}

function seedPunchRequests(): StoredPunchRequest[] {
  const at = (days: number, hour: number) => daysAgo(days, hour)
  const approve = (
    record: StoredPunchRequest,
    by: string,
    days: number,
    remarks: string | null = null,
  ) => applyDecision(record, 'approve', by, remarks, at(days, 15)).record
  const reject = (record: StoredPunchRequest, by: string, days: number, remarks: string) =>
    applyDecision(record, 'reject', by, remarks, at(days, 15)).record

  const jack = approve(
    approve(
      punch(
        10,
        'em_jack',
        'check-in',
        pastShift('em_jack', 4),
        'Card reader at the gate failed.',
        9,
      ),
      'em_daniel',
      8,
    ),
    ME,
    7,
    'Checked against the guard log.',
  )
  return [
    punch(
      1,
      ME,
      'check-in',
      pastShift(ME, 0),
      'Came in early for the payroll review; the device was offline.',
      1,
    ),
    approve(
      approve(
        punch(
          2,
          ME,
          'check-out',
          pastShift(ME, 3),
          'Left after the board meeting, forgot to punch.',
          5,
        ),
        'em_daniel',
        4,
      ),
      'em_kaleem',
      3,
    ),
    reject(
      punch(3, ME, 'missing-punch', pastShift(ME, 6), 'Badge was not working all day.', 9),
      'em_daniel',
      8,
      'The device log shows a punch at 09:02; no correction needed.',
    ),
    punch(
      4,
      'em_laiba',
      'check-in',
      pastShift('em_laiba', 1),
      'Interview panel started at the client site.',
      2,
    ),
    approve(
      punch(
        5,
        'em_ayesha',
        'check-out',
        pastShift('em_ayesha', 2),
        'Stayed for the vendor call.',
        4,
      ),
      ME,
      3,
      'Approved.',
    ),
    punch(
      6,
      'em_haroon',
      'check-in',
      pastShift('em_haroon', 1),
      'Worked from the client office in the morning.',
      2,
    ),
    punch(
      7,
      'em_mahnoor',
      'check-out',
      pastShift('em_mahnoor', 0),
      'Release went late; left after the gate closed.',
      1,
    ),
    approve(
      punch(
        8,
        'em_omar',
        'check-in',
        pastShift('em_omar', 2),
        'Branch opened by the manager on duty, punch missed.',
        3,
      ),
      'em_ayesha',
      2,
      'Confirmed with the branch.',
    ),
    punch(
      9,
      'em_sara',
      'check-out',
      pastShift('em_sara', 1),
      'Closing at the Karachi showroom.',
      2,
      [ME],
    ),
    applyCancelRequest(jack, 'em_jack', 'The machine record was restored by IT.', at(2, 11)),
    punch(
      11,
      'em_kashif',
      'missing-punch',
      pastShift('em_kashif', 1),
      'Visited the Rawalpindi office for the audit.',
      1,
      [ME],
    ),
  ]
}

function shift(
  number: number,
  employeeId: string,
  day: { date: string },
  change: { rosterGroupId: string } | { swapWithId: string },
  description: string,
  createdDaysAgo: number,
): StoredShiftRequest {
  const roster = 'rosterGroupId' in change ? rosterGroups.find(change.rosterGroupId) : undefined
  const swapWithId = 'swapWithId' in change ? change.swapWithId : null
  return newRecord<StoredShiftRequest>(
    {
      id: `srq_${number}`,
      code: `RQ-SFT-${String(140 + number).padStart(4, '0')}`,
      kind: 'shift',
      employeeId,
      createdById: employeeId,
      consents: swapWithId ? [{ personId: swapWithId, status: 'pending', remarks: null }] : [],
      payload: {
        date: day.date,
        rosterGroupId: roster?.id ?? null,
        rosterTitle: roster?.title ?? null,
        swapFrom: shiftText(employeeId, day.date),
        swapWithId,
        swapToShift: swapWithId ? shiftText(swapWithId, day.date) : null,
        description,
      },
    },
    daysAgo(createdDaysAgo),
  )
}

function seedShiftRequests(): StoredShiftRequest[] {
  const at = (days: number) => daysAgo(days, 16)
  const approve = (
    record: StoredShiftRequest,
    by: string,
    days: number,
    remarks: string | null = null,
  ) => applyDecision(record, 'approve', by, remarks, at(days)).record

  const sadia = shift(
    2,
    'em_sadia',
    nextShift('em_sadia', 1),
    { swapWithId: 'em_laiba' },
    'Family function in the evening.',
    1,
  )
  const rehan = shift(
    4,
    'em_rehan',
    nextShift('em_rehan', 2),
    { swapWithId: 'em_haroon' },
    'Doctor’s appointment in the afternoon.',
    2,
  )
  return [
    shift(
      1,
      ME,
      nextWeekdayShift(ME, 2),
      { rosterGroupId: 'rg_flexible' },
      'Training session in the morning.',
      1,
    ),
    sadia,
    approve(
      shift(
        3,
        'em_omer',
        shiftDay('em_omer', -1, 2, true),
        { rosterGroupId: 'rg_flexible' },
        'Quarter-end close.',
        6,
      ),
      ME,
      5,
      'Approved for the close.',
    ),
    applyConsent(rehan, 'em_haroon', 'approve', 'Fine with me.', at(1)),
    approve(
      shift(
        5,
        'em_hamza',
        nextWeekdayShift('em_hamza', 3),
        { rosterGroupId: 'rg_morning' },
        'Pairing with the Lahore team that week.',
        3,
      ),
      ME,
      2,
      'Approved on behalf of Bilal Ahmed.',
    ),
    applyDecision(
      shift(
        6,
        'em_daniyal',
        nextWeekdayShift('em_daniyal', 1),
        { rosterGroupId: 'rg_morning' },
        'Prefer the morning slot.',
        4,
      ),
      'reject',
      'em_jack',
      'Campaign launch needs the evening cover.',
      at(3),
    ).record,
    shift(
      7,
      'em_kaleem',
      nextWeekdayShift('em_kaleem', 0),
      { rosterGroupId: 'rg_morning' },
      'Covering the Islamabad onboarding.',
      0,
    ),
  ]
}

type TransferPayload = StoredTransferRequest['payload']

/** The application letter for a stored transfer, as "Regenerate" writes it. */
export function transferLetterFor(employeeId: string, payload: TransferPayload): string {
  const locationName = (id: string | null) => (id ? (locations.find(id)?.name ?? null) : null)
  const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? null) : null)
  return transferLetter({
    employee: ref(employeeId).name,
    finalAuthority: ref(payload.finalAuthorityId).name,
    effectiveDate: payload.effectiveDate,
    from: {
      location: locationName(payload.fromLocationId),
      branch: branchName(payload.fromBranchId),
      department: payload.fromDepartment,
    },
    to: {
      location: locationName(payload.locationId) ?? '',
      branch: branchName(payload.branchId) ?? '',
      department: payload.department,
    },
    lineManager: ref(payload.lineManagerId).name,
    description: payload.description,
  })
}

/** Where a person works now: their branch, its location, their department. */
export function currentPlace(employeeId: string) {
  const employee = mustFind(employeeId)
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  return {
    fromLocationId: branch?.locationId ?? null,
    fromBranchId: branch?.id ?? null,
    fromDepartment: employee.department,
  }
}

function transfer(
  number: number,
  employeeId: string,
  to: Pick<TransferPayload, 'locationId' | 'branchId' | 'department' | 'lineManagerId'>,
  effectiveInDays: number,
  description: string,
  createdDaysAgo: number,
): StoredTransferRequest {
  const payload: TransferPayload = {
    ...currentPlace(employeeId),
    ...to,
    finalAuthorityId: ME,
    effectiveDate: format(addDays(new Date(), effectiveInDays), 'yyyy-MM-dd'),
    attachmentName: null,
    description,
    application: '',
  }
  payload.application = transferLetterFor(employeeId, payload)
  return newTransferRecord(
    {
      id: `trq_${number}`,
      code: `RQ-TRF-${String(number).padStart(4, '0')}`,
      employeeId,
      createdById: employeeId,
      payload,
    },
    daysAgo(createdDaysAgo),
  )
}

/**
 * Haroon's request waits for Bilal Ahmed, whose approvals come to the
 * signed-in HR manager (Delegates); Saad's waits for the HR manager after
 * Bilal approved it; Omer's is approved.
 */
function seedTransferRequests(): StoredTransferRequest[] {
  const approve = (
    record: StoredTransferRequest,
    by: string,
    days: number,
    remarks: string | null = null,
  ) => decideTransfer(record, 'approve', by, remarks, daysAgo(days, 14)).record
  return [
    transfer(
      1,
      'em_haroon',
      {
        locationId: 'lc_isb',
        branchId: 'br_isb',
        department: 'Software',
        lineManagerId: 'em_omar',
      },
      21,
      'Moving to Islamabad with my family',
      2,
    ),
    approve(
      transfer(
        2,
        'em_saad',
        { locationId: 'lc_khi', branchId: 'br_khi', department: 'Sales', lineManagerId: 'em_sara' },
        14,
        'To support the mobile sales team in Karachi',
        4,
      ),
      'em_bilal',
      3,
      'Fine by me once the release is handed over.',
    ),
    approve(
      transfer(
        3,
        'em_omer',
        {
          locationId: 'lc_isb',
          branchId: 'br_isb',
          department: 'Finance',
          lineManagerId: 'em_hina',
        },
        7,
        'The Islamabad office needs a finance officer on site',
        9,
      ),
      ME,
      8,
      'Approved for the new office.',
    ),
  ]
}

/** An approved transfer, as recorded for the employee's records. */
export interface StoredEmployeeTransfer {
  id: string
  requestId: string
  code: string
  employeeId: string
  from: { locationId: string | null; branchId: string | null; department: string }
  to: { locationId: string; branchId: string; department: string }
  lineManagerId: string
  effectiveDate: string
  recordedAt: string
}

export function transferLogOf(record: StoredTransferRequest, at: string): StoredEmployeeTransfer {
  const { payload } = record
  return {
    id: `tl_${record.id}`,
    requestId: record.id,
    code: record.code,
    employeeId: record.employeeId,
    from: {
      locationId: payload.fromLocationId,
      branchId: payload.fromBranchId,
      department: payload.fromDepartment,
    },
    to: {
      locationId: payload.locationId,
      branchId: payload.branchId,
      department: payload.department,
    },
    lineManagerId: payload.lineManagerId,
    effectiveDate: payload.effectiveDate,
    recordedAt: at,
  }
}

export const punchRequests = createMockCollection<StoredPunchRequest>({
  storageKey: 'hrms-mock-punch-requests',
  seed: seedPunchRequests,
})
export const shiftRequests = createMockCollection<StoredShiftRequest>({
  storageKey: 'hrms-mock-shift-requests',
  seed: seedShiftRequests,
})
export const transferRequests = createMockCollection<StoredTransferRequest>({
  storageKey: 'hrms-mock-transfer-requests',
  seed: seedTransferRequests,
})
/** Approved transfers. The directory is left as it is; the log is what an approval changes. */
export const employeeTransfers = createMockCollection<StoredEmployeeTransfer>({
  storageKey: 'hrms-mock-employee-transfers',
  seed: () =>
    seedTransferRequests()
      .filter((record) => record.status === 'completed')
      .map((record) => transferLogOf(record, record.updatedAt)),
})

export function resetRequestsDb(): void {
  punchRequests.reset()
  shiftRequests.reset()
  transferRequests.reset()
  employeeTransfers.reset()
}
