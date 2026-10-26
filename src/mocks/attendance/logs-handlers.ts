import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type FileImportResult,
  PUNCH_TYPES,
  type PunchLog as WirePunch,
} from '@/features/attendance'
import { eachDay } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { fromWire, punchTypeFromWire, punchVersion, toWirePunch } from './backend'
import { attendanceIgnored, attendancePunches, type StoredPunch } from './db'
import { computeRange, takeSnapshot } from './engine'
import type { PunchLog } from './types'

/**
 * Attendance Logs as the API has them (`/api/attendance/logs`): list (≤ 31 days), export,
 * import (JSON lines and CSV), one punch, create / edit / delete manual and imported punches,
 * and ignore the others.
 */

const base = (path: string) => apiPath(`/attendance/logs${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = () => errorResponse(404, 'Punch not found', { code: 'NOT_FOUND' })
const today = () => format(new Date(), 'yyyy-MM-dd')
/** Longest range the log list serves at once. */
const MAX_DAYS = 31

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)

const punchSchema = z.object({
  employeeId: z.union([z.string(), z.number()]).transform(String),
  punchedAt: localDateTime,
  punchType: z.enum(PUNCH_TYPES),
  breakTypeId: z.union([z.string(), z.number()]).nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
  rowVersion: z.string().nullable().optional(),
})

interface Found {
  log: PunchLog
  employee: DirectoryEmployee
  stored: StoredPunch | undefined
}

/** Every punch of the people between two dates, newest first. */
function logRows(from: string, to: string, employees: readonly DirectoryEmployee[]) {
  const snap = takeSnapshot()
  return employees
    .flatMap((employee) =>
      computeRange(snap, employee.id, from, to).flatMap((item) =>
        item.logs.map((log) => toWirePunch(log, employee)),
      ),
    )
    .sort(
      (a, b) =>
        b.punchedAt.localeCompare(a.punchedAt) || a.employeeName.localeCompare(b.employeeName),
    )
}

const GENERATED = /^pl_(.+)_(\d{4}-\d{2}-\d{2})_(?:check|break)-(?:in|out)_\d+$/

/** A punch by id: a stored one, or one the engine generates for a day. */
function findPunch(id: string): Found | null {
  const stored = attendancePunches.find(id)
  if (stored) {
    const employee = findEmployee(stored.employeeId)
    return employee ? { log: stored, employee, stored } : null
  }
  const match = GENERATED.exec(id)
  const employee = match?.[1] ? findEmployee(match[1]) : undefined
  const date = match?.[2]
  if (!employee || !date) return null
  const log = computeRange(takeSnapshot(), employee.id, date, date)[0]?.logs.find(
    (item) => item.id === id,
  )
  return log ? { log, employee, stored: undefined } : null
}

const editable = (found: Found) =>
  found.stored !== undefined &&
  (found.stored.source === 'manual' || found.stored.source === 'import')

const conflict = () =>
  errorResponse(409, 'Someone else changed this punch. Reload it and try again', {
    code: 'CONFLICT',
  })

const ownPunch = () =>
  errorResponse(
    403,
    'You cannot enter or change your own punches. Raise a punch request instead.',
    {
      code: 'FORBIDDEN',
    },
  )

/** Reads a punch body; an error response when it is not valid. */
async function readPunch(request: Request) {
  const parsed = await readBody(request, punchSchema)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = String(issue?.path[0] ?? '')
    return {
      error: invalid(
        issue?.message ?? 'Some fields are not valid.',
        field ? { [field]: 'Not valid.' } : undefined,
      ),
    }
  }
  const input = parsed.data
  const employee = findEmployee(input.employeeId)
  if (!employee)
    return { error: invalid('Employee not found.', { employeeId: 'Employee not found.' }) }
  if (employee.id === CURRENT_EMPLOYEE_ID) return { error: ownPunch() }
  const at = fromWire(input.punchedAt)
  if (at.slice(0, 10) > today()) {
    return {
      error: invalid('Punches can only be for today or earlier.', {
        punchedAt: 'Choose today or earlier.',
      }),
    }
  }
  return { input, employee, at }
}

export const attendanceLogHandlers = [
  http.get(base(''), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const from = url.searchParams.get('fromDate') ?? ''
    const to = url.searchParams.get('toDate') ?? ''
    if (!day.safeParse(from).success || !day.safeParse(to).success) {
      return invalid('Give fromDate and toDate.', { fromDate: 'Field required' })
    }
    if (to < from) return invalid('The end date is before the start date.', { toDate: 'Too early' })
    if (eachDay(from, to).length > MAX_DAYS) {
      return invalid(`Choose at most ${MAX_DAYS} days.`, { toDate: 'Too far' })
    }
    const employeeId = url.searchParams.get('employeeId')
    const type = url.searchParams.get('punchType')
    const source = url.searchParams.get('source')
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const rows = logRows(
      from,
      to,
      DIRECTORY.filter((employee) => !employeeId || employee.id === employeeId),
    ).filter(
      (row) =>
        (!type || row.punchType === type) &&
        (!source || row.source === source) &&
        (!q || `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(q)),
    )
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<WirePunch>>(paginate(rows, page, pageSize))
  }),

  http.get(base('/export'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const from = url.searchParams.get('fromDate') ?? today()
    const to = url.searchParams.get('toDate') ?? from
    if (to < from || eachDay(from, to).length > MAX_DAYS) {
      return invalid(`Choose at most ${MAX_DAYS} days.`, { toDate: 'Too far' })
    }
    const rows = logRows(from, to, DIRECTORY)
    const lines = [
      'Employee Code,Employee Name,Punched At,Punch Type,Source,Device,Remarks',
      ...rows.map((row) =>
        [
          row.employeeCode,
          row.employeeName,
          row.punchedAt,
          row.punchType,
          row.source,
          row.deviceCode ?? '',
          (row.remarks ?? '').replace(/[",\n]/g, ' '),
        ].join(','),
      ),
    ]
    return new HttpResponse(lines.join('\n') + '\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  }),

  http.post(base('/import'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        lines: z
          .array(
            z.object({
              line: z.number().nullable().optional(),
              employeeCode: z.string(),
              punchedAt: z.string(),
              punchType: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(20000),
      }),
    )
    if (!parsed.success)
      return invalid('Give at least one line.', { lines: 'Give at least one line.' })
    const byCode = new Map(
      DIRECTORY.map((employee) => [profileOf(employee).code.toLowerCase(), employee]),
    )
    const result: FileImportResult = { created: 0, skipped: 0, failed: 0, errors: [] }
    parsed.data.lines.forEach((row, index) => {
      const line = row.line ?? index + 1
      const employee = byCode.get(row.employeeCode.trim().toLowerCase())
      const type = PUNCH_TYPES.find((item) => item === row.punchType)
      const at = fromWire(row.punchedAt)
      const problem = !employee
        ? `No employee with code ${row.employeeCode}.`
        : !localDateTime.safeParse(row.punchedAt).success
          ? 'The time is not valid.'
          : at.slice(0, 10) > today()
            ? 'The punch is in the future.'
            : !type
              ? 'The punch type is not valid.'
              : null
      if (problem || !employee || !type) {
        result.failed += 1
        result.errors.push({ line, message: problem ?? 'Not valid.' })
        return
      }
      const legacy = punchTypeFromWire(type)
      const exists = attendancePunches
        .all()
        .some(
          (punch) => punch.employeeId === employee.id && punch.at === at && punch.type === legacy,
        )
      if (exists) {
        result.skipped += 1
        return
      }
      attendancePunches.insert({
        id: createId('pl'),
        employeeId: employee.id,
        date: at.slice(0, 10),
        type: legacy,
        at,
        description: '',
        source: 'import',
        machineId: null,
        manuallyUpdated: false,
      })
      result.created += 1
    })
    return HttpResponse.json<ApiItem<FileImportResult>>({ data: result })
  }),

  http.get(base('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const found = findPunch(String(params.id))
    if (!found) return notFound()
    return HttpResponse.json<ApiItem<WirePunch>>({ data: toWirePunch(found.log, found.employee) })
  }),

  http.post(base(''), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const read = await readPunch(request)
    if (read.error) return read.error
    const { input, employee, at } = read
    const punch = attendancePunches.insert({
      id: createId('pl'),
      employeeId: employee.id,
      date: at.slice(0, 10),
      type: punchTypeFromWire(input.punchType),
      at,
      description: input.remarks ?? '',
      source: 'manual',
      machineId: null,
      manuallyUpdated: true,
    })
    return HttpResponse.json({ data: toWirePunch(punch, employee) }, { status: 201 })
  }),

  http.put(base('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const found = findPunch(String(params.id))
    if (!found) return notFound()
    if (!editable(found) || !found.stored) {
      return errorResponse(
        409,
        'Only manual and imported punches can be edited; ignore the others.',
        {
          code: 'PUNCH_NOT_EDITABLE',
        },
      )
    }
    const read = await readPunch(request)
    if (read.error) return read.error
    const { input, employee, at } = read
    if (input.rowVersion !== punchVersion(found.log)) return conflict()
    const updated = attendancePunches.update(found.stored.id, {
      ...found.stored,
      employeeId: employee.id,
      date: at.slice(0, 10),
      type: punchTypeFromWire(input.punchType),
      at,
      description: input.remarks ?? '',
      manuallyUpdated: true,
    })
    return HttpResponse.json<ApiItem<WirePunch>>({
      data: toWirePunch(updated ?? found.stored, employee),
    })
  }),

  http.patch(base('/:id/ignore'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const found = findPunch(String(params.id))
    if (!found) return notFound()
    if (found.employee.id === CURRENT_EMPLOYEE_ID) return ownPunch()
    const parsed = await readBody(
      request,
      z.object({ isIgnored: z.boolean(), rowVersion: z.string().nullable().optional() }),
    )
    if (!parsed.success) return invalid('Give isIgnored.', { isIgnored: 'Field required' })
    if (parsed.data.rowVersion !== punchVersion(found.log)) return conflict()
    const id = found.log.id
    if (parsed.data.isIgnored && !attendanceIgnored.find(id)) attendanceIgnored.insert({ id })
    if (!parsed.data.isIgnored && attendanceIgnored.find(id)) attendanceIgnored.remove(id)
    return HttpResponse.json<ApiItem<WirePunch>>({ data: toWirePunch(found.log, found.employee) })
  }),

  http.delete(base('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const found = findPunch(String(params.id))
    if (!found) return notFound()
    if (!editable(found) || !found.stored) {
      return errorResponse(
        409,
        'Only manual and imported punches can be deleted; ignore the others.',
        {
          code: 'PUNCH_NOT_EDITABLE',
        },
      )
    }
    if (found.employee.id === CURRENT_EMPLOYEE_ID) return ownPunch()
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (!rowVersion) return invalid('Give the rowVersion.', { rowVersion: 'Field required' })
    if (rowVersion !== punchVersion(found.log)) return conflict()
    attendancePunches.remove(found.stored.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
