import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type AttendanceLogRow,
  type FileImportResult,
  type MachineImportResult,
  type MachineInfo,
  PUNCH_TYPES,
} from '@/features/attendance'
import { eachDay } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { attendancePunches } from './db'
import { computeRange, takeSnapshot } from './engine'
import { MACHINE_IDS, machineBranch, machineSync } from './settings-db'

const base = (path: string) => apiPath(`/attendance/logs${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const today = () => format(new Date(), 'yyyy-MM-dd')
/** Longest range the log list serves at once. */
const MAX_DAYS = 31

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time')

const logSchema = z.object({
  employeeId: z.string().min(1, 'Choose the employee'),
  date: day,
  time,
  type: z.enum(PUNCH_TYPES),
  description: z.string().trim().max(200),
})

const editable = (source: string) => source === 'manual' || source === 'import'

function machineInfo(id: string): MachineInfo {
  const branchId = machineBranch(id)
  return {
    id,
    label: `Machine (${id})`,
    branch: branchId ? (branches.find(branchId)?.name ?? null) : null,
    lastSyncedAt: machineSync.find(id)?.lastSyncedAt ?? null,
  }
}

/** Every punch of everyone (or one person) between two dates, newest first. */
function logRows(from: string, to: string, employeeId: string | null): AttendanceLogRow[] {
  const snap = takeSnapshot()
  const people = DIRECTORY.filter((employee) => (employeeId ? employee.id === employeeId : true))
  return people
    .flatMap((employee) => {
      const ref = { id: employee.id, name: employee.name, code: profileOf(employee).code }
      return computeRange(snap, employee.id, from, to).flatMap((item) =>
        item.logs.map((log) => ({
          ...log,
          date: item.day.date,
          employee: ref,
          editable: editable(log.source) && attendancePunches.find(log.id) !== undefined,
        })),
      )
    })
    .sort((a, b) => b.at.localeCompare(a.at) || a.employee.name.localeCompare(b.employee.name))
}

/** Today's punches a machine has handed over so far. */
function machineCounts(id: string) {
  const date = today()
  const rows = logRows(date, date, null).filter((row) => row.machineId === id)
  return {
    checkIns: rows.filter((row) => row.type === 'check-in').length,
    checkOuts: rows.filter((row) => row.type === 'check-out').length,
  }
}

export const attendanceLogHandlers = [
  http.get(base(''), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? today()
    const to = url.searchParams.get('to') ?? from
    if (!day.safeParse(from).success || !day.safeParse(to).success || to < from) {
      return invalid('Choose a From date on or before the To date.')
    }
    if (eachDay(from, to).length > MAX_DAYS)
      return invalid(`Choose at most ${MAX_DAYS} days at a time.`)
    const type = url.searchParams.get('type')
    const source = url.searchParams.get('source')
    const rows = logRows(from, to, url.searchParams.get('employeeId')).filter(
      (row) => (!type || row.type === type) && (!source || row.source === source),
    )
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<AttendanceLogRow>>(paginate(rows, page, pageSize))
  }),

  http.get(base('/machines'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json<ApiItem<MachineInfo[]>>({ data: MACHINE_IDS.map(machineInfo) })
  }),

  http.post(base(''), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, logSchema)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return invalid(
        issue?.message ?? 'Some fields are not valid.',
        issue ? { [issue.path.join('.')]: issue.message } : undefined,
      )
    }
    const input = parsed.data
    const employee = findEmployee(input.employeeId)
    if (!employee) return invalid('Choose the employee.', { employeeId: 'Choose the employee' })
    if (input.date > today())
      return invalid('Punches can only be added for today or earlier.', {
        date: 'Choose today or earlier',
      })
    const id = createId('pl')
    attendancePunches.insert({
      id,
      employeeId: employee.id,
      date: input.date,
      type: input.type,
      at: `${input.date}T${input.time}`,
      description: input.description || 'Added on Attendance Logs',
      source: 'manual',
      machineId: null,
      manuallyUpdated: true,
    })
    return HttpResponse.json<ApiItem<{ id: string }>>({ data: { id } })
  }),

  http.put(base('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = attendancePunches.find(String(params.id))
    if (!existing || !editable(existing.source)) {
      return errorResponse(403, 'Only manual and imported punches can be edited.', {
        code: 'FORBIDDEN',
      })
    }
    const parsed = await readBody(request, logSchema)
    if (!parsed.success)
      return invalid(parsed.error.issues[0]?.message ?? 'Some fields are not valid.')
    const input = parsed.data
    if (input.date > today())
      return invalid('Punches can only be for today or earlier.', {
        date: 'Choose today or earlier',
      })
    attendancePunches.update(existing.id, {
      ...existing,
      employeeId: input.employeeId,
      date: input.date,
      type: input.type,
      at: `${input.date}T${input.time}`,
      description: input.description,
    })
    return HttpResponse.json<ApiItem<{ id: string }>>({ data: { id: existing.id } })
  }),

  http.delete(base('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = attendancePunches.find(String(params.id))
    if (!existing || !editable(existing.source)) {
      return errorResponse(403, 'Only manual and imported punches can be deleted.', {
        code: 'FORBIDDEN',
      })
    }
    attendancePunches.remove(existing.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/import/machines'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({ machineIds: z.array(z.enum(MACHINE_IDS as [string, ...string[]])).min(1) }),
    )
    if (!parsed.success)
      return invalid('Select at least one machine.', { machineIds: 'Select at least one machine' })
    const stamp = format(new Date(), "yyyy-MM-dd'T'HH:mm")
    let imported = 0
    const machines = parsed.data.machineIds.map((id) => {
      const before = machineCounts(id)
      const existing = machineSync.find(id)
      if (existing) machineSync.update(id, { ...existing, lastSyncedAt: stamp })
      else machineSync.insert({ id, lastSyncedAt: stamp })
      const after = machineCounts(id)
      imported += after.checkIns + after.checkOuts - before.checkIns - before.checkOuts
      return { ...machineInfo(id), ...after }
    })
    return HttpResponse.json<ApiItem<MachineImportResult>>({ data: { machines, imported } })
  }),

  http.post(base('/import/file'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        rows: z
          .array(
            z.object({
              employeeCode: z.string(),
              date: z.string(),
              time: z.string(),
              type: z.string(),
            }),
          )
          .min(1)
          .max(2000),
      }),
    )
    if (!parsed.success) return invalid('The file has no rows to import.')
    const byCode = new Map(
      DIRECTORY.map((employee) => [profileOf(employee).code.toLowerCase(), employee]),
    )
    const result: FileImportResult = { created: 0, skipped: 0, errors: [] }
    parsed.data.rows.forEach((row, index) => {
      const line = index + 2
      const employee = byCode.get(row.employeeCode.trim().toLowerCase())
      const type = PUNCH_TYPES.find((item) => item === row.type)
      if (!employee) result.errors.push(`Line ${line}: no employee with code ${row.employeeCode}`)
      else if (!day.safeParse(row.date).success || row.date > today())
        result.errors.push(`Line ${line}: the date must be today or earlier (yyyy-mm-dd)`)
      else if (!time.safeParse(row.time).success)
        result.errors.push(`Line ${line}: the time must be HH:mm`)
      else if (!type)
        result.errors.push(`Line ${line}: the punch type must be ${PUNCH_TYPES.join(', ')}`)
      else {
        const at = `${row.date}T${row.time}`
        const exists = attendancePunches
          .all()
          .some(
            (punch) => punch.employeeId === employee.id && punch.at === at && punch.type === type,
          )
        if (exists) {
          result.skipped += 1
          return
        }
        attendancePunches.insert({
          id: createId('pl'),
          employeeId: employee.id,
          date: row.date,
          type,
          at,
          description: 'Imported from a file',
          source: 'import',
          machineId: null,
          manuallyUpdated: true,
        })
        result.created += 1
        return
      }
      result.skipped += 1
    })
    return HttpResponse.json<ApiItem<FileImportResult>>({ data: result })
  }),
]
