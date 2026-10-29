import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type BiometricDevice,
  DEVICE_STATUSES,
  type DeviceEnrolment,
  type DeviceImportResult,
  formatLocal,
  PUNCH_TYPES,
} from '@/features/attendance'
import type { ApiItem, Paginated } from '@/types/api'

import { punchTypeFromWire } from '../attendance/backend'
import { addMachinePunch, attendancePunches } from '../attendance/db'
import { computeDay, takeSnapshot } from '../attendance/engine'
import { machineFor, machineSync, nextRowVersion } from '../attendance/settings-db'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import {
  deviceEnrolments,
  devices,
  enrolmentId,
  type StoredDevice,
  type StoredEnrolment,
  utcNow,
} from './db'

/**
 * The mock of `/api/attendance/settings/devices`: the devices (list with search, branch and
 * status; one; create; edit; delete), everyone enrolled on a device (all at once), and punch
 * lines a device hands over, which become machine punches in Attendance Logs. Same bodies,
 * checks and answers as the API: `{data, meta}` pages, `{data}` items, 422 with
 * `fieldErrors`, 404, and 409 on a stale rowVersion or a device still in use.
 */

const base = (path: string) => apiPath(`/attendance/settings/devices${path}`)

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = () => errorResponse(404, 'Device not found', { code: 'NOT_FOUND' })
const conflict = () =>
  errorResponse(409, 'Someone else changed this device. Reload it and try again.', {
    code: 'CONFLICT',
  })

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const enrolmentsOf = (deviceId: string) =>
  deviceEnrolments.all().filter((row) => row.deviceId === deviceId)

const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? null) : null)

function toWire(device: StoredDevice): BiometricDevice {
  return {
    ...device,
    branchName: branchName(device.branchId),
    enrolledCount: enrolmentsOf(device.id).length,
  }
}

function toWireEnrolment(row: StoredEnrolment): DeviceEnrolment {
  const employee = findEmployee(row.employeeId)
  return {
    employeeId: row.employeeId,
    employeeCode: employee ? profileOf(employee).code : row.employeeId,
    employeeName: employee?.name ?? row.employeeId,
    deviceUserNo: row.deviceUserNo,
    createdAt: row.createdAt,
  }
}

/** Shortest numbers first, so 999 sorts before 1001. */
const byUserNo = (a: StoredEnrolment, b: StoredEnrolment) =>
  a.deviceUserNo.length - b.deviceUserNo.length || a.deviceUserNo.localeCompare(b.deviceUserNo)

/** Does Attendance keep punches of this device? Its own machines punch for every branch. */
function hasPunches(device: StoredDevice): boolean {
  const generated = DIRECTORY.some(
    (employee) =>
      machineFor(employee.branchId, 'check-in') === device.code ||
      machineFor(employee.branchId, 'check-out') === device.code,
  )
  return generated || attendancePunches.all().some((punch) => punch.machineId === device.code)
}

/** `MCH-00014` after `MCH-00013`. */
function nextCode(): string {
  const highest = devices
    .all()
    .reduce((max, device) => Math.max(max, Number(/^MCH-(\d+)$/.exec(device.code)?.[1] ?? 0)), 0)
  return `MCH-${String(highest + 1).padStart(5, '0')}`
}

type DeviceFields = Pick<
  StoredDevice,
  'name' | 'model' | 'serialNo' | 'ipAddress' | 'port' | 'branchId' | 'address' | 'status'
>

/** Reads a `DeviceIn`, with every field's problem at once. */
async function readDevice(
  request: Request,
  current: StoredDevice | null,
): Promise<{ error: Response } | { fields: DeviceFields; rowVersion: string | null }> {
  const body: unknown = await request.json().catch(() => null)
  if (!isRecord(body)) return { error: invalid('Send the device as JSON.') }
  const errors: Record<string, string> = {}
  const text = (key: string, max: number, required = false): string | null => {
    const value = body[key]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      if (required) errors[key] = 'Field required'
      return null
    }
    if (typeof value !== 'string') {
      errors[key] = 'Must be text'
      return null
    }
    if (value.trim().length > max) errors[key] = `At most ${String(max)} characters`
    return value.trim()
  }

  const name = text('name', 200, true)
  const model = text('model', 100)
  const serialNo = text('serialNo', 50)
  const ipAddress = text('ipAddress', 45)
  if (ipAddress && !errors.ipAddress && !IPV4.test(ipAddress)) {
    errors.ipAddress = 'Not a valid IPv4 address'
  }
  const address = text('address', 500)

  const rawPort = body.port
  let port: number | null = null
  if (rawPort !== undefined && rawPort !== null) {
    if (
      typeof rawPort === 'number' &&
      Number.isInteger(rawPort) &&
      rawPort >= 1 &&
      rawPort <= 65535
    ) {
      port = rawPort
    } else errors.port = 'Must be a whole number from 1 to 65535'
  }

  const rawBranch = body.branchId
  let branchId: string | null = null
  if (rawBranch !== undefined && rawBranch !== null && rawBranch !== '') {
    branchId =
      typeof rawBranch === 'number' || typeof rawBranch === 'string' ? String(rawBranch) : ''
    if (!branchId || !branches.find(branchId)) errors.branchId = 'Branch not found'
  }

  const rawStatus = body.status ?? 'active'
  const status = DEVICE_STATUSES.find((item) => item === rawStatus)
  if (!status) errors.status = 'Must be active or inactive'

  if (serialNo && !errors.serialNo) {
    const owner = devices
      .all()
      .find(
        (device) =>
          device.id !== current?.id && device.serialNo?.toLowerCase() === serialNo.toLowerCase(),
      )
    if (owner) errors.serialNo = `${owner.name} (${owner.code}) has this serial no`
  }

  if (Object.keys(errors).length > 0 || !name || !status) {
    return { error: invalid('Some fields need your attention.', errors) }
  }
  const rowVersion = typeof body.rowVersion === 'string' ? body.rowVersion : null
  return {
    fields: { name, model, serialNo, ipAddress, port, branchId, address, status },
    rowVersion,
  }
}

const enrolmentsBody = z.object({
  enrolments: z
    .array(
      z.object({
        employeeId: z.union([z.string(), z.number()]).transform(String),
        deviceUserNo: z.string(),
      }),
    )
    .max(20000),
  rowVersion: z.string().nullable().optional(),
})

const punchesBody = z.object({
  lines: z
    .array(
      z.object({
        line: z.number().int().nullable().optional(),
        deviceUserNo: z.string().min(1).max(30),
        punchedAt: z.string().min(1).max(40),
        punchType: z.string().max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(20000),
})

/** `2026-10-28T09:02:11` or `2026-10-28 09:02` → `2026-10-28T09:02`; null when not a real time. */
function readLocal(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (!match) return null
  const [, year = '', month = '', day = '', hour = '', minute = '', second = '00'] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const real =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    Number(hour) < 24 &&
    Number(minute) < 60 &&
    Number(second) < 60
  return real ? `${year}-${month}-${day}T${hour}:${minute}` : null
}

async function guarded(request: Request): Promise<Response | null> {
  await latency()
  return requireAuth(request)
}

export const deviceHandlers: HttpHandler[] = [
  http.get(base(''), async ({ request }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const branchId = url.searchParams.get('branchId')
    const status = url.searchParams.get('status')
    if (status && !DEVICE_STATUSES.some((item) => item === status)) {
      return invalid('status must be active or inactive.', { status: 'Not valid' })
    }
    const rows = devices
      .all()
      .map(toWire)
      .filter(
        (device) =>
          (!branchId || device.branchId === branchId) &&
          (!status || device.status === status) &&
          (!q ||
            [
              device.code,
              device.name,
              device.model,
              device.serialNo,
              device.ipAddress,
              device.branchName,
              device.address,
            ].some((value) => value?.toLowerCase().includes(q))),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<BiometricDevice>>(paginate(rows, page, pageSize))
  }),

  http.post(base(''), async ({ request }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const read = await readDevice(request, null)
    if ('error' in read) return read.error
    const code = nextCode()
    const device = devices.insert({
      ...read.fields,
      id: code,
      code,
      lastSyncedAt: null,
      createdAt: utcNow(),
      updatedAt: null,
      rowVersion: nextRowVersion(),
    })
    return HttpResponse.json<ApiItem<BiometricDevice>>({ data: toWire(device) }, { status: 201 })
  }),

  http.get(base('/:id'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    return device
      ? HttpResponse.json<ApiItem<BiometricDevice>>({ data: toWire(device) })
      : notFound()
  }),

  http.put(base('/:id'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    if (!device) return notFound()
    const read = await readDevice(request, device)
    if ('error' in read) return read.error
    if (!read.rowVersion) return invalid('Give the rowVersion.', { rowVersion: 'Field required' })
    if (read.rowVersion !== device.rowVersion) return conflict()
    const updated = devices.update(device.id, {
      ...device,
      ...read.fields,
      updatedAt: utcNow(),
      rowVersion: nextRowVersion(),
    })
    return HttpResponse.json<ApiItem<BiometricDevice>>({ data: toWire(updated ?? device) })
  }),

  http.delete(base('/:id'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    if (!device) return notFound()
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (rowVersion && rowVersion !== device.rowVersion) return conflict()
    // History stays readable: a device in use is set Inactive, not deleted.
    const enrolled = enrolmentsOf(device.id).length
    const punches = hasPunches(device)
    if (enrolled > 0 || punches) {
      const what = [
        enrolled > 0 ? `${plural(enrolled, 'person', 'people')} enrolled` : null,
        punches ? 'punches in the attendance log' : null,
      ]
        .filter(Boolean)
        .join(' and ')
      return errorResponse(
        409,
        `${device.name} (${device.code}) has ${what}, so it cannot be deleted. Set it to Inactive instead.`,
        { code: 'DEVICE_IN_USE' },
      )
    }
    devices.remove(device.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(base('/:id/enrolments'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    if (!device) return notFound()
    return HttpResponse.json<ApiItem<DeviceEnrolment[]>>({
      data: enrolmentsOf(device.id).sort(byUserNo).map(toWireEnrolment),
    })
  }),

  http.put(base('/:id/enrolments'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    if (!device) return notFound()
    const parsed = enrolmentsBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return invalid('Send the enrolments.', { enrolments: 'Field required' })
    const { enrolments, rowVersion } = parsed.data
    if (!rowVersion) return invalid('Give the rowVersion.', { rowVersion: 'Field required' })
    if (rowVersion !== device.rowVersion) return conflict()

    const errors: Record<string, string> = {}
    const people = new Set<string>()
    const numbers = new Map<string, string>()
    enrolments.forEach((row, index) => {
      const employee = findEmployee(row.employeeId)
      const number = row.deviceUserNo.trim()
      if (!employee) errors[`enrolments.${String(index)}.employeeId`] = 'Employee not found'
      else if (people.has(employee.id)) {
        errors[`enrolments.${String(index)}.employeeId`] = `${employee.name} is listed twice`
      }
      if (employee) people.add(employee.id)
      if (!/^\d{1,30}$/.test(number)) {
        errors[`enrolments.${String(index)}.deviceUserNo`] = 'Use 1 to 30 digits'
        return
      }
      const owner = numbers.get(number)
      if (owner) {
        errors[`enrolments.${String(index)}.deviceUserNo`] =
          `${number} is already ${owner}'s number on this device`
      } else numbers.set(number, employee?.name ?? row.employeeId)
    })
    if (Object.keys(errors).length > 0) {
      return invalid('Some enrolments need your attention.', errors)
    }

    const before = new Map(enrolmentsOf(device.id).map((row) => [row.employeeId, row]))
    for (const row of before.values()) deviceEnrolments.remove(row.id)
    const now = utcNow()
    for (const row of enrolments) {
      deviceEnrolments.insert({
        id: enrolmentId(device.id, row.employeeId),
        deviceId: device.id,
        employeeId: row.employeeId,
        deviceUserNo: row.deviceUserNo.trim(),
        createdAt: before.get(row.employeeId)?.createdAt ?? now,
      })
    }
    const updated = devices.update(device.id, {
      ...device,
      updatedAt: now,
      rowVersion: nextRowVersion(),
    })
    return HttpResponse.json<ApiItem<BiometricDevice>>({ data: toWire(updated ?? device) })
  }),

  http.post(base('/:id/punches'), async ({ request, params }) => {
    const denied = await guarded(request)
    if (denied) return denied
    const device = devices.find(String(params.id))
    if (!device) return notFound()
    const parsed = punchesBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return invalid('Send 1 to 20000 lines, each with a device user no and a punch time.', {
        lines: 'Not valid',
      })
    }

    // The device has handed its punches over: today's machine punches show up to now.
    const now = new Date()
    const local = formatLocal(now)
    if (machineSync.find(device.code)) {
      machineSync.update(device.code, { id: device.code, lastSyncedAt: local })
    }
    devices.update(device.id, { ...device, lastSyncedAt: utcNow(), rowVersion: nextRowVersion() })

    const snap = takeSnapshot(now)
    const people = new Map(enrolmentsOf(device.id).map((row) => [row.deviceUserNo, row.employeeId]))
    /** `employeeId:date` → that day's punches as `at|type` (stored, generated, and added here). */
    const known = new Map<string, Set<string>>()
    const punchesOn = (employeeId: string, date: string) => {
      const key = `${employeeId}:${date}`
      let set = known.get(key)
      if (!set) {
        set = new Set(computeDay(snap, employeeId, date).logs.map((log) => `${log.at}|${log.type}`))
        known.set(key, set)
      }
      return set
    }

    const result: DeviceImportResult = { created: 0, skipped: 0, failed: 0, errors: [] }
    parsed.data.lines.forEach((row, index) => {
      const line = row.line ?? index + 1
      const fail = (message: string) => {
        result.failed += 1
        result.errors.push({ line, message })
      }
      const number = row.deviceUserNo.trim()
      const employeeId = people.get(number)
      if (!employeeId) {
        fail(`No one on this device has user no ${number}.`)
        return
      }
      const at = readLocal(row.punchedAt)
      if (!at) {
        fail(`"${row.punchedAt}" is not a date and time (yyyy-mm-dd hh:mm).`)
        return
      }
      if (at > local) {
        fail('The punch is in the future.')
        return
      }
      const day = punchesOn(employeeId, at.slice(0, 10))
      const given = (row.punchType ?? '').trim()
      // No type given: the day's first punch is the check in, the next ones check outs.
      const type = given
        ? PUNCH_TYPES.find((item) => item === given.toLowerCase())
        : [...day].some((entry) => entry.endsWith('|check-in'))
          ? 'check_out'
          : 'check_in'
      if (!type) {
        fail(`"${given}" is not a punch type: use check_in, check_out, break_out or break_in.`)
        return
      }
      const legacy = punchTypeFromWire(type)
      const key = `${at}|${legacy}`
      if (day.has(key)) {
        result.skipped += 1
        return
      }
      addMachinePunch({ employeeId, at, type: legacy, machineId: device.code })
      day.add(key)
      result.created += 1
    })
    return HttpResponse.json<ApiItem<DeviceImportResult>>({ data: result })
  }),
]

/** Restores the module's mock tables to their seed data (used between tests). */
export function resetDevicesDb(): void {
  devices.reset()
  deviceEnrolments.reset()
}
