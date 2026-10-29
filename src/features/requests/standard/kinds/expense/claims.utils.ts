import { format, parse } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { type RequestBody, typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext } from '../../standard.types'
import { STANDARD_STATUS_META } from '../../standard-styles'

/*
 * Helpers the claim types share (Expense, Air Tickets, Requisition).
 */

/** An amount from the API: numbers in the details, decimal strings on settings. */
export function toAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

/** "PKR 1,500.00"; a dash for none. */
export function money(value: number | string | null | undefined, currency?: string | null) {
  const amount = toAmount(value)
  if (amount === null) return '—'
  return `${currency ?? 'PKR'} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Popup tables: Poppins Medium 11 headers, Regular 12 cells, as the request popups draw them. */
export const claimTableClass =
  'w-full min-w-[40rem] text-xs [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-grey [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted'

const asDate = (date: string) => parse(date.slice(0, 10), 'yyyy-MM-dd', new Date())

/** "October 20, 2026"; a dash for none. */
export const viewDay = (date: string | null | undefined) =>
  date ? format(asDate(date), 'MMMM d, yyyy') : '—'

/** "Oct 2026" for a payroll month. */
export const viewMonth = (date: string | null | undefined) =>
  date ? format(asDate(date), 'MMM yyyy') : '—'

export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

/** A typed amount ("4,999.50") as a number, or null when it is not one. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/,/g, '').trim()
  if (clean === '' || !/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Number(clean)
}

/**
 * The Filters dialog: the filters the API takes (employee, department,
 * status, dates), plus the delegator on Approvals → Delegates.
 */
export function claimFilterFields({
  kind,
  tab,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const fields: FilterField[] = [
    employeeFilterField(typePermission(kind, 'create')),
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups?.departments ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: REQUEST_STATUSES.map((value) => ({
        value,
        label: STANDARD_STATUS_META[value].label,
      })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (tab === 'approvals' && view === 'delegates') {
    fields.splice(2, 0, {
      kind: 'select',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      options: (lookups?.delegators ?? []).map((person) => ({
        value: person.id,
        label: person.name,
      })),
    })
  }
  return fields
}

/** A typed request body as the shared create / update hooks take it. */
export function requestBody<D extends object>(body: RequestBody<D>): RequestBody {
  return { ...body, details: { ...body.details } as Record<string, unknown> }
}

/** The largest amount one claim may be (the API refuses more). */
export const MAX_CLAIM_AMOUNT = 10_000_000

/**
 * Expense "Approve": a lowered amount may not be above its claim. Keyed `lines.<id>` so each
 * shows once, at its own box; empty when everything is fine.
 */
export function expenseDecisionProblems(
  request: { payload: { lines: readonly { id: string; amount: number | string }[] } },
  value: Record<string, unknown>,
): Record<string, string> {
  const lines = Array.isArray(value.lines)
    ? (value.lines as { id: string; approvedAmount: number }[])
    : []
  const problems: Record<string, string> = {}
  for (const line of request.payload.lines) {
    const approved = lines.find((item) => item.id === line.id)?.approvedAmount
    if (approved !== undefined && approved > (toAmount(line.amount) ?? 0)) {
      problems[`lines.${line.id}`] = 'Not more than the claim'
    }
  }
  return problems
}
