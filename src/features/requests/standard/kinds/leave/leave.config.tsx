import { format, parse, parseISO } from 'date-fns'

import type { DataTableColumn } from '@/components/layout'
import type { FilterField } from '@/features/payroll'

import { typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES } from '../../../types/requests.types'
import type {
  StandardFilterContext,
  StandardKindConfig,
  StandardRequest,
} from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import { shortTypeLabel } from './leave.lookups'
import type { LeavePayload } from './leave.types'
import { LeaveBalanceCard } from './leave-balance'
import { LeaveBalanceFields, LeaveDetail } from './leave-detail'
import { LeaveForm } from './leave-form'

type Column = DataTableColumn<StandardRequest<LeavePayload>>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
/** "Aug 30", or "Aug 30 – Sep 2". */
const dates = (from: string | null, to: string | null) =>
  !from || !to
    ? (from ?? '—')
    : from === to
      ? format(day(from), 'MMM d')
      : `${format(day(from), 'MMM d')} – ${format(day(to), 'MMM d')}`
/** "Thu, 29 Aug 2024". */
const longDay = (date: string) => format(day(date), 'EEE, d MMM yyyy')
/** 1, 0.5. */
const count = (value: number | null) =>
  value === null ? '—' : String(Math.round(value * 100) / 100)

/** The filters the API takes (`departmentId`, `from`, `to`, `status`, `employeeId`). */
function filterFields({ tab, scope, lookups }: StandardFilterContext): readonly FilterField[] {
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups?.departments ?? []).map((item) => ({ value: item.id, label: item.name })),
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
    fields.unshift(
      employeeFilterField(typePermission('leave', 'create'), {
        label: 'Employee Name',
        placeholder: 'Select Employee Name',
      }),
    )
  }
  return fields
}

/** A short leave reads "Short Leave", with its type and share under it. */
const leaveType = (): Column =>
  col.text('leaveType', 'Leave Type', (row) =>
    row.payload.isShort ? (
      <span className="grid">
        <span className="whitespace-nowrap">Short Leave</span>
        <span className="text-[0.6875rem] whitespace-nowrap">
          {row.payload.leaveTypeName} · {shortTypeLabel(row.payload.shortLeaveType)}
        </span>
      </span>
    ) : (
      nowrap(row.payload.leaveTypeName ?? '—')
    ),
  )

/**
 * The list's columns (frame 4189:54603); Approvals → Requested draws the same.
 * The frame's Rosters column is left out: the API keeps no roster on a leave.
 */
const listColumns = (): readonly Column[] => [
  col.code(),
  col.employee(),
  col.department(),
  leaveType(),
  col.text('count', 'Count', (row) => count(row.days ?? row.payload.days)),
  col.text('dates', 'Dates', (row) => nowrap(dates(row.fromDate, row.toDate))),
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
  // The API decides a cancellation from its own box (Cancellations).
  approvalViews: ['requested', 'cancellations', 'delegates'],
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
          col.text('count', 'Count', (row) => count(row.days ?? row.payload.days)),
          col.text('date', 'Date', (row) =>
            nowrap(format(parseISO(row.createdAt), 'EEE, d MMM yyyy')),
          ),
          col.text('required', 'Required Date', (row) =>
            nowrap(
              !row.fromDate
                ? '—'
                : !row.toDate || row.fromDate === row.toDate
                  ? longDay(row.fromDate)
                  : `${longDay(row.fromDate)} – ${longDay(row.toDate)}`,
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
