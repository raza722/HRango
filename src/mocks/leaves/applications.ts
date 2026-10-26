import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type DepartmentLookup,
  type EmployeeLookup,
  ENCASHMENT_BASES,
  ENCASHMENT_MODES,
  type EncashmentDetail,
  LEAVE_STATUSES,
  type LeaveApplication,
  type LeaveApplicationCounts,
  type LeaveApplicationDetail,
  type LeaveBalanceRow,
  type LedgerEntry,
} from '@/features/leaves/types/leaves.types'
import type { ApiItem, Paginated } from '@/types/api'

import { lookupPage } from '../employees/lookup'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { leaveEncashments, leaveLedger, leaveRequests, leaveTypeStore } from './db'
import {
  applicationOut,
  balanceOf,
  balanceRows,
  isSubordinate,
  personOf,
  runAllotment,
} from './rules'
import {
  MOCK_DEPARTMENTS,
  MOCK_PEOPLE,
  MOCK_SELF_ID,
  nextRowVersion,
  type StoredEncashment,
  type StoredLeaveRequest,
  type StoredLedgerEntry,
  thisYear,
} from './seed'

/*
 * My Leaves / Leave Applications (`/api/leaves/applications`), balances and the ledger, the
 * allotment and carry forward runs, leave encashment, and fallbacks for the two look-ups the
 * Leaves pickers use (`/employees/lookup`, `/organisation/lookups/departments`; the
 * employees and organisation mocks answer first when they define them).
 */

const invalid = (
  fieldErrors: Record<string, string>,
  message = 'Some fields need your attention.',
) => errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors })

const notFound = (what: string) => errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })

const id = z.union([z.string(), z.number()]).transform(String)

/** `?tab=my|subordinates|all` and the filters of the list and the counts. */
function filtered(url: URL): StoredLeaveRequest[] {
  const get = (key: string) => url.searchParams.get(key) ?? undefined
  const tab = get('tab') ?? 'all'
  const q = get('q')?.trim().toLowerCase()
  const fromDate = get('fromDate')
  const toDate = get('toDate')
  return leaveRequests
    .all()
    .filter((row) =>
      tab === 'my'
        ? row.employeeId === MOCK_SELF_ID
        : tab === 'subordinates'
          ? isSubordinate(row.employeeId)
          : true,
    )
    .filter((row) => !get('leaveTypeId') || row.leaveTypeId === get('leaveTypeId'))
    .filter((row) => !get('employeeId') || row.employeeId === get('employeeId'))
    .filter(
      (row) =>
        !get('departmentId') || personOf(row.employeeId)?.departmentId === get('departmentId'),
    )
    .filter((row) => !toDate || row.fromDate <= toDate)
    .filter((row) => !fromDate || row.toDate >= fromDate)
    .filter((row) => {
      if (!q) return true
      const person = personOf(row.employeeId)
      return `${row.code} ${row.reason ?? ''} ${person?.name ?? ''} ${person?.code ?? ''}`
        .toLowerCase()
        .includes(q)
    })
}

function ledgerOut(row: StoredLedgerEntry): LedgerEntry {
  const person = personOf(row.employeeId)
  const type = leaveTypeStore.find(row.leaveTypeId)
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: person?.code ?? '',
    employeeName: person?.name ?? '—',
    leaveTypeId: row.leaveTypeId,
    leaveTypeTitle: type?.title ?? '—',
    shortCode: type?.shortCode ?? null,
    fiscalYear: row.fiscalYear,
    entryDate: row.entryDate,
    days: row.days,
    reason: row.reason,
    remarks: row.remarks,
    requestId: null,
    requestCode: null,
    leaveEncashmentId: row.leaveEncashmentId,
    warningId: null,
    createdAt: row.createdAt,
  }
}

function encashmentOut(row: StoredEncashment): EncashmentDetail {
  const type = leaveTypeStore.find(row.leaveTypeId)
  const lines = row.lines.map((line) => {
    const person = personOf(line.employeeId)
    return {
      ...line,
      employeeCode: person?.code ?? '',
      employeeName: person?.name ?? '—',
      departmentName: person?.departmentName ?? null,
    }
  })
  return {
    ...row,
    leaveTypeTitle: type?.title ?? '—',
    shortCode: type?.shortCode ?? null,
    employeeCount: lines.length,
    totalDays: lines.reduce((sum, line) => sum + line.days, 0),
    totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
    paidCount: lines.filter((line) => line.payslipId).length,
    lines,
  }
}

const encashmentIn = z.object({
  leaveTypeId: id,
  fiscalYear: z.number().int().min(2000).max(2100),
  encashmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appliesToAll: z.boolean().default(false),
  employeeIds: z.array(id).max(5000).default([]),
  basis: z.enum(ENCASHMENT_BASES),
  amountPerLeave: z.number().min(0),
  mode: z.enum(ENCASHMENT_MODES),
})

const encashmentUpdate = z.object({
  encashmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  basis: z.enum(ENCASHMENT_BASES),
  amountPerLeave: z.number().min(0),
  mode: z.enum(ENCASHMENT_MODES),
  rowVersion: z.string().nullable().optional(),
})

export const leaveApplicationHandlers: HttpHandler[] = [
  // --- Applications -------------------------------------------------------------------------------
  http.get(apiPath('/leaves/applications/counts'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rows = filtered(new URL(request.url))
    const counts = Object.fromEntries([
      ['all', rows.length],
      ...LEAVE_STATUSES.map((status) => [
        status,
        rows.filter((row) => row.status === status).length,
      ]),
    ]) as LeaveApplicationCounts
    return HttpResponse.json<ApiItem<LeaveApplicationCounts>>({ data: counts })
  }),

  http.get(apiPath('/leaves/applications/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const row = leaveRequests.find(String(params.id))
    if (!row) return notFound('Leave application')
    const detail: LeaveApplicationDetail = {
      ...applicationOut(row),
      balance: balanceOf(row.employeeId, row.leaveTypeId, Number(row.fromDate.slice(0, 4))),
    }
    return HttpResponse.json<ApiItem<LeaveApplicationDetail>>({ data: detail })
  }),

  http.get(apiPath('/leaves/applications'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const status = url.searchParams.get('status')
    const rows = filtered(url)
      .filter((row) => !status || row.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(applicationOut)
    return HttpResponse.json<Paginated<LeaveApplication>>(paginate(rows, page, pageSize))
  }),

  // --- Balances and ledger ------------------------------------------------------------------------
  http.get(apiPath('/leaves/balances'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const asOf = url.searchParams.get('asOf')
    const year = asOf ? Number(asOf.slice(0, 4)) : thisYear()
    // The mock user holds company scope, but without an employee the mock answers for the
    // signed-in person (Shelley), as an own-scope Employee would see it.
    const employeeId = url.searchParams.get('employeeId') ?? MOCK_SELF_ID
    const leaveTypeId = url.searchParams.get('leaveTypeId')
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const rows = balanceRows(year)
      .filter((row) => row.employeeId === employeeId)
      .filter((row) => !leaveTypeId || row.leaveTypeId === leaveTypeId)
      .filter((row) => !q || `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(q))
    return HttpResponse.json<Paginated<LeaveBalanceRow>>(paginate(rows, page, pageSize))
  }),

  http.get(apiPath('/leaves/ledger'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const get = (key: string) => url.searchParams.get(key)
    const rows = leaveLedger
      .all()
      .filter((row) => !get('employeeId') || row.employeeId === get('employeeId'))
      .filter((row) => !get('leaveTypeId') || row.leaveTypeId === get('leaveTypeId'))
      .filter((row) => !get('fiscalYear') || String(row.fiscalYear) === get('fiscalYear'))
      .filter((row) => !get('reason') || row.reason === get('reason'))
      .map(ledgerOut)
    return HttpResponse.json<Paginated<LedgerEntry>>(paginate(rows, page, pageSize))
  }),

  http.post(apiPath('/leaves/ledger'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = z
      .object({
        employeeId: id,
        leaveTypeId: id,
        entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        days: z.number().min(-366).max(366),
        reason: z.enum(['opening', 'adjustment']),
        remarks: z.string().max(2000).nullable().default(null),
      })
      .safeParse(await request.json())
    if (!parsed.success) return invalid({ body: parsed.error.issues[0]?.message ?? 'Invalid' })
    if (!personOf(parsed.data.employeeId)) return invalid({ employeeId: 'Employee not found.' })
    if (!leaveTypeStore.find(parsed.data.leaveTypeId)) {
      return invalid({ leaveTypeId: 'Leave type not found.' })
    }
    const row = leaveLedger.insert({
      ...parsed.data,
      id: createId('ll'),
      fiscalYear: Number(parsed.data.entryDate.slice(0, 4)),
      leaveEncashmentId: null,
      createdAt: new Date().toISOString(),
    })
    return HttpResponse.json<ApiItem<LedgerEntry>>({ data: ledgerOut(row) }, { status: 201 })
  }),

  http.post(apiPath('/leaves/allotment/process'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = z
      .object({
        fiscalYear: z.number().int().min(2000).max(2100),
        leaveTypeId: id.nullable().optional(),
        employeeId: id.nullable().optional(),
      })
      .safeParse(await request.json())
    if (!parsed.success) return invalid({ fiscalYear: 'Enter a year from 2000 to 2100.' })
    const result = runAllotment(
      parsed.data.fiscalYear,
      parsed.data.leaveTypeId ?? undefined,
      parsed.data.employeeId ?? undefined,
    )
    return HttpResponse.json({ data: result })
  }),

  http.post(apiPath('/leaves/carry-forward/process'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = z
      .object({
        fromFiscalYear: z.number().int().min(2000).max(2100),
        leaveTypeId: id.nullable().optional(),
        employeeId: id.nullable().optional(),
      })
      .safeParse(await request.json())
    if (!parsed.success) return invalid({ fromFiscalYear: 'Enter a year from 2000 to 2100.' })
    const { fromFiscalYear: year, leaveTypeId, employeeId } = parsed.data
    let carried = 0
    let days = 0
    for (const type of leaveTypeStore.all()) {
      if (!type.carryForward || (leaveTypeId && type.id !== leaveTypeId)) continue
      for (const person of MOCK_PEOPLE) {
        if (employeeId && person.id !== employeeId) continue
        const done = leaveLedger
          .all()
          .some(
            (row) =>
              row.employeeId === person.id &&
              row.leaveTypeId === type.id &&
              row.fiscalYear === year + 1 &&
              row.reason === 'carry_forward',
          )
        const left = balanceOf(person.id, type.id, year).available
        if (done || left <= 0) continue
        const cap = type.accumulativeCount
          ? (type.accumulativeCount - 1) * (type.allowance ?? 0)
          : left
        const amount = Math.min(left, cap)
        if (amount <= 0) continue
        const now = new Date().toISOString()
        const entry = {
          employeeId: person.id,
          leaveTypeId: type.id,
          remarks: null,
          leaveEncashmentId: null,
          createdAt: now,
        }
        leaveLedger.insert({
          ...entry,
          id: createId('ll'),
          fiscalYear: year,
          entryDate: `${String(year)}-12-31`,
          days: -amount,
          reason: 'carry_forward',
        })
        leaveLedger.insert({
          ...entry,
          id: createId('ll'),
          fiscalYear: year + 1,
          entryDate: `${String(year + 1)}-01-01`,
          days: amount,
          reason: 'carry_forward',
        })
        carried += 1
        days += amount
      }
    }
    return HttpResponse.json({ data: { fromFiscalYear: year, carried, days } })
  }),

  // --- Encashment ---------------------------------------------------------------------------------
  http.get(apiPath('/leaves/encashments/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const row = leaveEncashments.find(String(params.id))
    if (!row) return notFound('Leave encashment')
    return HttpResponse.json<ApiItem<EncashmentDetail>>({ data: encashmentOut(row) })
  }),

  http.get(apiPath('/leaves/encashments'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const get = (key: string) => url.searchParams.get(key)
    const rows = leaveEncashments
      .all()
      .filter((row) => !get('leaveTypeId') || row.leaveTypeId === get('leaveTypeId'))
      .filter((row) => !get('fiscalYear') || String(row.fiscalYear) === get('fiscalYear'))
      .filter((row) => !get('mode') || row.mode === get('mode'))
      .filter(
        (row) =>
          !get('employeeId') || row.lines.some((line) => line.employeeId === get('employeeId')),
      )
      .map((row) => {
        const { lines: _lines, ...summary } = encashmentOut(row)
        return summary
      })
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.post(apiPath('/leaves/encashments'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = encashmentIn.safeParse(await request.json())
    if (!parsed.success) return invalid({ body: parsed.error.issues[0]?.message ?? 'Invalid' })
    const input = parsed.data
    const type = leaveTypeStore.find(input.leaveTypeId)
    if (!type) return invalid({ leaveTypeId: 'Leave type not found.' })
    if (!type.allowEncashment) return invalid({ leaveTypeId: 'This leave type is not encashable.' })
    const people = input.appliesToAll ? MOCK_PEOPLE.map((person) => person.id) : input.employeeIds
    const encashmentId = createId('le')
    const lines = people.flatMap((employeeId) => {
      const available = balanceOf(employeeId, type.id, input.fiscalYear).available
      if (available <= 0 || (type.encashmentMin !== null && available < type.encashmentMin))
        return []
      const daysPaid =
        type.encashmentMax === null ? available : Math.min(available, type.encashmentMax)
      leaveLedger.insert({
        id: createId('ll'),
        employeeId,
        leaveTypeId: type.id,
        fiscalYear: input.fiscalYear,
        entryDate: input.encashmentDate,
        days: -daysPaid,
        reason: 'encashed',
        remarks: null,
        leaveEncashmentId: encashmentId,
        createdAt: new Date().toISOString(),
      })
      return [
        {
          id: createId('lel'),
          employeeId,
          days: daysPaid,
          amount: daysPaid * input.amountPerLeave,
          payslipId: null,
        },
      ]
    })
    if (lines.length === 0) {
      return invalid({ employeeIds: 'Nobody has days to encash.' }, 'Nobody has days to encash.')
    }
    const stored: StoredEncashment = {
      id: encashmentId,
      leaveTypeId: type.id,
      fiscalYear: input.fiscalYear,
      encashmentDate: input.encashmentDate,
      appliesToAll: input.appliesToAll,
      basis: input.basis,
      amountPerLeave: input.amountPerLeave,
      mode: input.mode,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      rowVersion: nextRowVersion(),
      lines,
    }
    leaveEncashments.insert(stored)
    return HttpResponse.json<ApiItem<EncashmentDetail>>(
      { data: encashmentOut(stored) },
      { status: 201 },
    )
  }),

  http.put(apiPath('/leaves/encashments/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leaveEncashments.find(String(params.id))
    if (!current) return notFound('Leave encashment')
    const parsed = encashmentUpdate.safeParse(await request.json())
    if (!parsed.success) return invalid({ body: parsed.error.issues[0]?.message ?? 'Invalid' })
    if (current.lines.some((line) => line.payslipId)) {
      return errorResponse(409, 'This encashment is paid and cannot be changed.', {
        code: 'LOCKED',
      })
    }
    const { rowVersion: _rowVersion, ...input } = parsed.data
    const next: StoredEncashment = {
      ...current,
      ...input,
      lines: current.lines.map((line) => ({ ...line, amount: line.days * input.amountPerLeave })),
      updatedAt: new Date().toISOString(),
      rowVersion: nextRowVersion(),
    }
    leaveEncashments.update(current.id, next)
    return HttpResponse.json<ApiItem<EncashmentDetail>>({ data: encashmentOut(next) })
  }),

  http.delete(apiPath('/leaves/encashments/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leaveEncashments.find(String(params.id))
    if (!current) return notFound('Leave encashment')
    if (current.lines.some((line) => line.payslipId)) {
      return errorResponse(409, 'This encashment is paid and cannot be deleted.', {
        code: 'LOCKED',
      })
    }
    for (const row of leaveLedger.all()) {
      if (row.leaveEncashmentId === current.id) leaveLedger.remove(row.id)
    }
    leaveEncashments.remove(current.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Look-up fallbacks --------------------------------------------------------------------------
  http.get(apiPath('/employees/lookup'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rows: EmployeeLookup[] = MOCK_PEOPLE.map((person) => ({
      id: person.id,
      code: person.code,
      name: person.name,
      designationName: person.designationName,
      jobTitleName: null,
      departmentId: person.departmentId,
      departmentName: person.departmentName,
      branchId: null,
      branchName: 'Head Office',
      status: person.status,
      photoUrl: null,
    }))
    return HttpResponse.json<Paginated<EmployeeLookup>>(lookupPage(rows, new URL(request.url)))
  }),

  http.get(apiPath('/organisation/lookups/departments'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rows: DepartmentLookup[] = MOCK_DEPARTMENTS.map((department) => ({
      id: department.id,
      name: department.name,
      code: null,
      parentId: null,
    }))
    return HttpResponse.json<ApiItem<DepartmentLookup[]>>({ data: rows })
  }),
]
