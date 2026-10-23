import { format, parse, parseISO } from 'date-fns'

import type { DataTableColumn } from '@/components/layout'
import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type {
  StandardFilterContext,
  StandardKindConfig,
  StandardRequest,
} from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { LeaveLookups, LeavePayload } from './leave.types'
import { LeaveBalanceCard } from './leave-balance'
import { LeaveBalanceFields, LeaveDetail } from './leave-detail'
import { LeaveForm } from './leave-form'

type Column = DataTableColumn<StandardRequest<LeavePayload>>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
/** "Aug 30", or "Aug 30 – Sep 2". */
const dates = (from: string, to: string) =>
  from === to
    ? format(day(from), 'MMM d')
    : `${format(day(from), 'MMM d')} – ${format(day(to), 'MMM d')}`
/** "Thu, 29 Aug 2024". */
const longDay = (date: string) => format(day(date), 'EEE, d MMM yyyy')
/** 1, 0.5. */
const count = (value: number) => String(Math.round(value * 100) / 100)

function filterFields({ tab, scope, lookups }: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as LeaveLookups | undefined
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups?.departments ?? []).map((name) => ({ value: name, label: name })),
    },
    {
      kind: 'select',
      key: 'leaveTypeId',
      label: 'Leave Type',
      placeholder: 'Select Leave Type',
      options: (extra?.leaveTypes ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
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
  ]
  // All Requests and the approvals add the person (frame 4194:70010).
  if (tab === 'approvals' || scope === 'all') {
    fields.unshift({
      kind: 'select',
      key: 'employeeId',
      label: 'Employee Name',
      placeholder: 'Select Employee Name',
      options: (lookups?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
    })
  }
  return fields
}

/** A short leave reads "Short Leave", with its type and share under it. */
const leaveType = (): Column =>
  col.text('leaveType', 'Leave Type', (row) =>
    row.payload.short ? (
      <span className="grid">
        <span className="whitespace-nowrap">Short Leave</span>
        <span className="text-[0.6875rem] whitespace-nowrap">
          {row.payload.leaveTypeName} · {row.payload.shortTypeLabel}
        </span>
      </span>
    ) : (
      nowrap(row.payload.leaveTypeName)
    ),
  )

/** The list's columns (frame 4189:54603); Approvals → Requested draws the same. */
const listColumns = (): readonly Column[] => [
  col.code(),
  col.employee(),
  col.department(),
  col.text('rosters', 'Rosters', (row) => (
    <span className="text-[0.6875rem] whitespace-nowrap">{row.payload.rosterTitle}</span>
  )),
  leaveType(),
  col.text('count', 'Count', (row) => count(row.payload.count)),
  col.text('dates', 'Dates', (row) => nowrap(dates(row.payload.from, row.payload.to))),
  col.text('requestedAt', 'Requested At', (row) => (
    <span className="grid whitespace-nowrap">
      <span>{format(parseISO(row.createdAt), 'MMMM d, yyyy')}</span>
      <span>{format(parseISO(row.createdAt), 'hh:mm a')}</span>
    </span>
  )),
  col.status({}),
]

/**
 * Leave (section 2697:5532, frames 4189:54603 … 4220:76856): Requests with My
 * Request / All Requests, the balance card and "Request" heading over the
 * status tabs, bulk Approved / Unapproved; Approvals with Requested and
 * Delegates. The Approve popup adds the person's balance of the leave type.
 */
export const leaveConfig: StandardKindConfig<LeavePayload> = {
  kind: 'leave',
  label: 'Leave',
  noun: 'Leave',
  requestsTitle: 'Leave Request',
  approvalsTitle: 'Approvals',
  scopeLabels: { my: 'My Request', all: 'All Requests' },
  approvalViews: ['requested', 'delegates'],
  statusTabs: true,
  bulk: true,
  ListHeader: LeaveBalanceCard,
  requestColumns: listColumns,
  approvalColumns: (view) =>
    view === 'delegates'
      ? [
          col.code(),
          col.employee('Employees'),
          col.department(),
          leaveType(),
          col.text('count', 'Count', (row) => count(row.payload.count)),
          col.text('date', 'Date', (row) =>
            nowrap(format(parseISO(row.createdAt), 'EEE, d MMM yyyy')),
          ),
          col.text('required', 'Required Date', (row) =>
            nowrap(
              row.payload.from === row.payload.to
                ? longDay(row.payload.from)
                : `${longDay(row.payload.from)} – ${longDay(row.payload.to)}`,
            ),
          ),
          {
            ...col.authority('Approving Authority'),
            cell: (row) => (
              <span className="text-[0.6875rem] font-medium whitespace-nowrap">
                {row.currentStep?.authority ?? row.flow.at(-1)?.authority ?? '—'}
              </span>
            ),
          },
          col.nextRequestee('Request Flow'),
          col.status({}),
        ]
      : listColumns(),
  filterFields,
  FormDialog: LeaveForm,
  DetailRows: LeaveDetail,
  DecisionFields: LeaveBalanceFields,
}
