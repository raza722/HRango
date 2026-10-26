import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import { ENCASHMENT_BASES, ENCASHMENT_TYPES, type LeaveEncashmentDetail } from '@/features/payroll'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { leaveTypes } from '../leaves/db'
import { createId, latency, requireAuth } from '../utils'
import { leaveEncashments } from './db'
import {
  base,
  conflict,
  invalid,
  notFound,
  numberParam,
  ok,
  page,
  param,
  readBody,
  rejected,
  searched,
} from './http'
import { isActive, nextRowVersion, salaryOn } from './people'
import { encashmentWithLines } from './seed-records'

// Leave encashment as `/api/payroll/leave-encashments` serves it. Days are what is left of the
// leave type's quota in the year (a fixed quota per type here, less what was encashed already).

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const now = () => new Date().toISOString().slice(0, 19)
const today = () => format(new Date(), 'yyyy-MM-dd')

const QUOTA: Record<string, number> = { lt_sick: 8, lt_casual: 10, lt_annual: 14 }

const leaveName = (id: string) => leaveTypes.find(id)?.title ?? 'Leave'

/** Days left to encash: the quota less this year's other encashments of the type. */
function daysLeft(employeeId: string, leaveTypeId: string, year: number, ignore?: string) {
  const used = leaveEncashments
    .all()
    .filter(
      (item) => item.id !== ignore && item.leaveTypeId === leaveTypeId && item.fiscalYear === year,
    )
    .flatMap((item) => item.employees)
    .filter((line) => line.employeeId === employeeId)
    .reduce((sum, line) => sum + line.days, 0)
  return Math.max(0, (QUOTA[leaveTypeId] ?? 5) - used)
}

const input = z
  .object({
    leaveTypeId: z.coerce.string().min(1, 'Choose the leave type'),
    fiscalYear: z.number().int().min(2000).max(2100),
    allEmployees: z.boolean().default(false),
    employeeIds: z.array(z.coerce.string()).max(10000).default([]),
    mode: z.enum(ENCASHMENT_TYPES),
    basis: z.enum(ENCASHMENT_BASES),
    amountPerLeave: z.number().gt(0).nullish(),
    rowVersion: z.string().nullish(),
  })
  .refine((value) => value.basis === 'earned_salary' || Boolean(value.amountPerLeave), {
    message: 'Give the amount per leave for this basis.',
    path: ['amountPerLeave'],
  })

export const payrollEncashmentHandlers = [
  http.get(base('/leave-encashments'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const leaveTypeId = param(url, 'leaveTypeId')
    const year = numberParam(url, 'year')
    const employeeId = param(url, 'employeeId')
    const lines = leaveEncashments
      .all()
      .sort((a, b) => b.encashmentDate.localeCompare(a.encashmentDate))
      .flatMap((item) => item.employees)
      .filter(
        (line) =>
          (!leaveTypeId || line.leaveTypeId === leaveTypeId) &&
          (year === undefined || line.fiscalYear === year) &&
          (!employeeId || line.employeeId === employeeId),
      )
    return page(
      url,
      searched(url, lines, (line) => `${line.employeeName} ${line.employeeCode}`),
    )
  }),

  http.get(base('/leave-encashments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = leaveEncashments.find(String(params.id))
    return found ? ok(found) : notFound('leave encashment')
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      base(method === 'post' ? '/leave-encashments' : '/leave-encashments/:id'),
      async ({ request, params }) => {
        const denied = await authed(request)
        if (denied) return denied
        const body = await readBody(request, input)
        if (!body.success) return rejected(body.error)
        const value = body.data
        const current = method === 'put' ? leaveEncashments.find(String(params.id)) : undefined
        if (method === 'put' && !current) return notFound('leave encashment')
        if (current && value.rowVersion && value.rowVersion !== current.rowVersion) {
          return conflict('Someone else changed this leave encashment. Reload it and try again')
        }
        if (current?.isPaid) {
          return conflict('This encashment was paid. It cannot be changed', 'ENCASHMENT_PAID')
        }
        if (!value.allEmployees && value.employeeIds.length === 0) {
          return invalid('Choose the employees.', { employeeIds: 'Choose the employees.' })
        }
        const people = value.allEmployees
          ? DIRECTORY.filter((employee) => isActive(employee.id)).map((employee) => employee.id)
          : value.employeeIds.filter((id) => Boolean(findEmployee(id)))
        const lines = people
          .map(
            (id) => [id, daysLeft(id, value.leaveTypeId, value.fiscalYear, current?.id)] as const,
          )
          .filter(([, days]) => days > 0)
        if (lines.length === 0) {
          return invalid('Nobody chosen has leave days to encash.', {
            employeeIds: 'Nobody chosen has leave days to encash.',
          })
        }
        // Earned salary: a day's salary (monthly / 30) of the first person; the API works it out
        // per person, the mock keeps one rate per encashment.
        const first = lines[0]?.[0] ?? ''
        const amountPerLeave = value.amountPerLeave ?? Math.round(salaryOn(first, today()) / 30)
        const detail: LeaveEncashmentDetail = encashmentWithLines(
          {
            id: current?.id ?? createId('le'),
            leaveTypeId: value.leaveTypeId,
            leaveTypeName: leaveName(value.leaveTypeId),
            fiscalYear: value.fiscalYear,
            encashmentDate: current?.encashmentDate ?? today(),
            appliesToAll: value.allEmployees,
            basis: value.basis,
            amountPerLeave,
            mode: value.mode,
            isPaid: false,
            createdAt: current?.createdAt ?? now(),
            updatedAt: current ? now() : null,
            rowVersion: nextRowVersion(),
          },
          lines,
        )
        if (current) leaveEncashments.update(detail.id, detail)
        else leaveEncashments.insert(detail)
        return HttpResponse.json({ data: detail }, { status: current ? 200 : 201 })
      },
    ),
  ),

  http.delete(base('/leave-encashments/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = leaveEncashments.find(String(params.id))
    if (!found) return notFound('leave encashment')
    const sent = param(new URL(request.url), 'rowVersion')
    if (sent && sent !== found.rowVersion) {
      return conflict('Someone else changed this leave encashment. Reload it and try again')
    }
    if (found.isPaid) {
      return conflict('This encashment was paid. It cannot be deleted', 'ENCASHMENT_PAID')
    }
    leaveEncashments.remove(found.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
