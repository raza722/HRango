import { z } from 'zod'

import type { MonthlyOvertime } from '@/features/attendance'

import {
  activeOvertimePolicy,
  recentWorkday,
  recordApprovedOvertime,
} from '../../../attendance/overtime-db'
import { DIRECTORY, findEmployee } from '../../../employees/seed'
import { branches, locations } from '../../../settings/handlers'
import { mockDepartmentId, type RequestBodyIn, type RequestHeaderFields } from '../../backend'
import { invalid } from '../../http'
import {
  defineStandardKind,
  type ExportColumn,
  type PayloadContext,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import { toHm } from './time-window'

/*
 * Overtime (Attendance → Overtime) on the request engine: `POST /requests/overtime` with
 * `details {departmentId, locationId, branchId, overtimeDate, startTime, endTime,
 * appliedMinutes}`, approved through `/requests/approvals` with `details.approvedMinutes`.
 * One request per person and day; the applied minutes fit between the two clocks (the whole
 * window when left out). Approving the last step writes the approved minutes onto the
 * person's day (the time sheet's Approved Overtime); an approved cancellation takes them off.
 */

export interface OvertimeStored {
  departmentId: string
  locationId: string | null
  branchId: string | null
  overtimeDate: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  appliedMinutes: number
  approvedMinutes: number | null
  reason: string
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const hmPattern = /^([01]\d|2[0-3]):[0-5]\d$/

const schema = z.object({
  departmentId: z.string().min(1, 'Choose the department'),
  locationId: z.string().nullable(),
  branchId: z.string().nullable(),
  overtimeDate: z.string().regex(ymd, 'Choose the date'),
  startTime: z.string().regex(hmPattern, 'Enter the start time'),
  endTime: z.string().regex(hmPattern, 'Enter the end time'),
  appliedMinutes: z.number().int().positive('More than 0 minutes').nullable(),
  reason: z.string().trim().max(4000),
})
type Input = z.infer<typeof schema>

const idText = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null

/** `RequestIn[OvertimeDetails]` → the type's input. */
function fromBody(body: RequestBodyIn) {
  const details = body.details
  return {
    departmentId: idText(details.departmentId) ?? '',
    locationId: idText(details.locationId),
    branchId: idText(details.branchId),
    overtimeDate:
      typeof details.overtimeDate === 'string' ? details.overtimeDate : (body.fromDate ?? ''),
    startTime: toHm(details.startTime),
    endTime: toHm(details.endTime),
    appliedMinutes: typeof details.appliedMinutes === 'number' ? details.appliedMinutes : null,
    reason: body.reason ?? '',
  }
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as OvertimeStored

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** The department name behind `/organisation/lookups/departments`' `dep_<slug>` ids. */
const departmentName = (id: string) =>
  DIRECTORY.find((employee) => mockDepartmentId(employee.department) === id)?.department ?? null

const LIVE: readonly StoredStandardRequest['status'][] = ['pending', 'completed', 'cancelling']

function toPayload(input: Input, context: PayloadContext): Response | Record<string, unknown> {
  if (!departmentName(input.departmentId)) {
    return invalid('Choose the department.', { departmentId: 'Choose the department' })
  }
  const span = minutesOf(input.endTime) - minutesOf(input.startTime)
  if (span <= 0) {
    return invalid('End after the start time.', { endTime: 'End after the start time' })
  }
  const applied = input.appliedMinutes ?? span
  if (applied > span) {
    return invalid('The applied minutes do not fit between the two clocks.', {
      appliedMinutes: `At most ${String(span)} minutes, the time between the two clocks`,
    })
  }
  const clash = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === context.employeeId &&
      LIVE.includes(record.status) &&
      stored(record).overtimeDate === input.overtimeDate,
  )
  if (clash) {
    const name = findEmployee(context.employeeId)?.name ?? context.employeeId
    return invalid(`${name} already has overtime on ${input.overtimeDate} (${clash.code}).`, {
      overtimeDate: 'One overtime request per day',
    })
  }
  const payload: OvertimeStored = {
    departmentId: input.departmentId,
    locationId: input.locationId,
    branchId: input.branchId,
    overtimeDate: input.overtimeDate,
    startTime: input.startTime,
    endTime: input.endTime,
    appliedMinutes: applied,
    approvedMinutes: null,
    reason: input.reason,
  }
  return { ...payload }
}

function header(payload: Record<string, unknown>): RequestHeaderFields {
  const value = payload as unknown as OvertimeStored
  return {
    fromDate: value.overtimeDate,
    toDate: value.overtimeDate,
    days: null,
    reason: value.reason || null,
    description: null,
    application: null,
  }
}

/** The stored request as the API's `details`, with the names beside the ids. */
function toDetails(payload: Record<string, unknown>) {
  const value = payload as unknown as OvertimeStored
  return {
    departmentId: value.departmentId,
    departmentName: departmentName(value.departmentId),
    locationId: value.locationId,
    locationName: value.locationId ? (locations.find(value.locationId)?.name ?? null) : null,
    branchId: value.branchId,
    branchName: value.branchId ? (branches.find(value.branchId)?.name ?? null) : null,
    overtimeDate: value.overtimeDate,
    startTime: `${value.startTime}:00`,
    endTime: `${value.endTime}:00`,
    appliedMinutes: value.appliedMinutes,
    approvedMinutes: value.approvedMinutes,
  }
}

const decisionSchema = z.object({ approvedMinutes: z.number().int().min(0).nullish() })

/** An export column read from the row's `details`. */
const detailColumn = (header: string, name: string): ExportColumn => [
  header,
  (row) => {
    const value = row.details[name]
    return typeof value === 'string' || typeof value === 'number' ? value : null
  },
]

const def: StandardKindServer<Input> = {
  kind: 'overtime',
  typeCode: 'overtime',
  typeName: 'Overtime',
  settingsType: 'overtime',
  codePrefix: 'OT-',
  codeDigits: 4,
  fromBody,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.overtimeDate),
  header,
  toDetails,
  exportColumns: [
    detailColumn('Overtime Date', 'overtimeDate'),
    detailColumn('Start Time', 'startTime'),
    detailColumn('End Time', 'endTime'),
    detailColumn('Applied Minutes', 'appliedMinutes'),
    detailColumn('Approved Minutes', 'approvedMinutes'),
    detailColumn('Location', 'locationName'),
    detailColumn('Branch', 'branchName'),
  ],
  decision: {
    schema: z.record(z.string(), z.unknown()),
    // Each approver may set the minutes; without them the applied minutes stand (bulk approve).
    apply: (record, extras) => {
      const parsed = decisionSchema.safeParse(extras)
      if (!parsed.success) {
        return invalid('Enter the approved minutes.', { approvedMinutes: 'Whole minutes only' })
      }
      const value = stored(record)
      const minutes = parsed.data.approvedMinutes ?? value.approvedMinutes ?? value.appliedMinutes
      if (minutes <= 0) {
        return invalid('Approve more than 0 minutes, or reject the request.', {
          approvedMinutes: 'Approve more than 0 minutes, or reject the request',
        })
      }
      if (minutes > value.appliedMinutes) {
        return invalid('The approved minutes cannot be more than the applied minutes.', {
          approvedMinutes: `At most the ${String(value.appliedMinutes)} minutes applied for`,
        })
      }
      return { ...record.payload, approvedMinutes: minutes }
    },
  },
  onCompleted: (record) => {
    const value = stored(record)
    return recordApprovedOvertime(
      record.employeeId,
      value.overtimeDate,
      value.approvedMinutes ?? value.appliedMinutes,
    )
  },
  onCancelled: (record) => {
    const effect = record.effect as { previous?: number } | undefined
    recordApprovedOvertime(record.employeeId, stored(record).overtimeDate, effect?.previous)
  },
  seed: () => {
    const make = (
      number: number,
      employeeId: string,
      date: string,
      status: StoredStandardRequest['status'],
      request: Partial<OvertimeStored> & { remarks?: string },
    ): StoredStandardRequest => {
      const digits = String(number).padStart(4, '0')
      const { remarks, ...fields } = request
      const payload: OvertimeStored = {
        departmentId: 'dep_human-resource-management',
        locationId: 'lc_lhr',
        branchId: 'br_lhr_ho',
        overtimeDate: date,
        startTime: '18:00',
        endTime: '21:00',
        appliedMinutes: 180,
        approvedMinutes: null,
        reason: 'Meet Deadline',
        ...fields,
      }
      return seedRequest(def, {
        id: `ot_${digits}`,
        code: `OT-${digits}`,
        employeeId,
        payload: { ...payload },
        at: new Date(`${date}T21:10:00`).toISOString(),
        status,
        ...(remarks ? { remarks } : {}),
      })
    }
    const software = { departmentId: 'dep_software', branchId: 'br_lhr_jt' }
    return [
      // My Overtime (Shelley Kannes): approved, pending and rejected, as the frame draws them.
      make(1, 'em_shelley', recentWorkday(5), 'completed', { approvedMinutes: 180 }),
      make(2, 'em_shelley', recentWorkday(2), 'pending', {}),
      make(3, 'em_shelley', recentWorkday(8), 'rejected', {
        remarks: 'The release moved; no overtime was needed that evening.',
      }),
      // Waiting for the line manager (Bilal Ahmed) before the HR manager.
      make(4, 'em_haroon', recentWorkday(1), 'pending', {
        ...software,
        reason: 'Production release',
      }),
      // Shelley's own reports: their requests wait for her alone.
      make(5, 'em_sadia', recentWorkday(1), 'pending', {
        startTime: '17:30',
        endTime: '19:30',
        appliedMinutes: 120,
        reason: 'Payroll inputs',
      }),
      make(6, 'em_omer', recentWorkday(3), 'pending', {
        departmentId: 'dep_finance',
        endTime: '23:00',
        appliedMinutes: 300,
        reason: 'Month-end closing',
      }),
      make(7, 'em_rehan', recentWorkday(4), 'completed', {
        ...software,
        approvedMinutes: 180,
        reason: 'Client demo',
      }),
      make(8, 'em_mahnoor', recentWorkday(6), 'completed', {
        ...software,
        endTime: '20:00',
        appliedMinutes: 120,
        approvedMinutes: 120,
        reason: 'Regression run',
      }),
      make(9, 'em_maryam', recentWorkday(6), 'completed', {
        ...software,
        endTime: '20:00',
        appliedMinutes: 120,
        approvedMinutes: 90,
        reason: 'Regression run',
      }),
      make(10, 'em_asad', recentWorkday(6), 'pending', {
        ...software,
        branchId: 'br_rwp',
        endTime: '20:00',
        appliedMinutes: 120,
        reason: 'Regression run',
      }),
    ]
  },
}

export const overtimeServer = defineStandardKind(def)

// --- what the rest of Attendance reads ----------------------------------------------------------

let readRecords: () => StoredStandardRequest[] = () => []

/** Set by `../index.ts`: the overtime requests of the shared table. */
export function bindOvertimeRecords(getter: () => StoredStandardRequest[]): void {
  readRecords = getter
}

const approvedOf = (record: StoredStandardRequest) => {
  const value = stored(record)
  return value.approvedMinutes ?? value.appliedMinutes
}

/** How many overtime requests were approved since a moment (ISO), e.g. under a policy. */
export function approvedOvertimeSince(iso: string): number {
  return readRecords().filter((record) => record.status === 'completed' && record.updatedAt >= iso)
    .length
}

/** A person's approved overtime on a date (0 when none was approved). */
export function approvedOvertimeOn(employeeId: string, date: string): number {
  return readRecords()
    .filter(
      (record) =>
        record.employeeId === employeeId &&
        record.status === 'completed' &&
        stored(record).overtimeDate === date,
    )
    .reduce((sum, record) => sum + approvedOf(record), 0)
}

/**
 * A person's approved overtime of a month (`yyyy-MM`) and the active monthly policy's slab
 * it reaches: for the time sheets, Leaves and Payroll mocks.
 */
export function approvedOvertimeInMonth(employeeId: string, month: string): MonthlyOvertime {
  const approvedMinutes = readRecords()
    .filter(
      (record) =>
        record.employeeId === employeeId &&
        record.status === 'completed' &&
        stored(record).overtimeDate.startsWith(month),
    )
    .reduce((sum, record) => sum + approvedOf(record), 0)
  const slab =
    activeOvertimePolicy('monthly')?.slabs.find(
      (item) => approvedMinutes >= item.minMinutes && approvedMinutes <= item.maxMinutes,
    ) ?? null
  return { employeeId, month, approvedMinutes, slab }
}
