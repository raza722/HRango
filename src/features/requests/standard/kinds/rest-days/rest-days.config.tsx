import { format, parse } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { RestDayPayload } from './rest-days.types'
import { RestDaysDetail } from './rest-days-detail'
import { RestDaysForm } from './rest-days-form'

/** "Thursday, 29 Aug 2024", as the lists write dates. */
const longDay = (date: string | null) =>
  date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE, d MMM yyyy') : '—'

/** The filters the API takes (`employeeId`, `departmentId`, `status`, `from`, `to`, `delegatorId`). */
function filterFields({ kind, tab, view, lookups }: StandardFilterContext): readonly FilterField[] {
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
        hint: person.code,
      })),
    })
  }
  return fields
}

/**
 * Rest Days (frames 2877:16549 … 2888:19984): Requests with My / All,
 * Approvals with Requested / Cancellations / Delegates. The frames draw no
 * status tabs over these lists. The API's type is `rest_day`
 * (`/requests/rest-day`); the frames' Shift, Time and Duration columns are left
 * out (the API keeps the roster, not its times, on the request).
 */
export const restDaysConfig: StandardKindConfig<RestDayPayload> = {
  kind: 'rest-days',
  label: 'Rest Days',
  noun: 'Rest Days',
  requestsTitle: 'Rest Days Requests',
  approvalsTitle: 'Rest Days Approvals',
  scopeLabels: { my: 'My Requests', all: 'All Requests' },
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: false,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('rosters', 'Rosters', (row) => row.payload.rosterGroupName ?? '—'),
    col.text('from', 'Date (from)', (row) => nowrap(longDay(row.fromDate))),
    col.text('to', 'Date (to)', (row) => nowrap(longDay(row.toDate))),
    col.text('count', 'Days', (row) => row.days ?? row.payload.days.length),
    col.text('payable', 'Payable', (row) => (
      <span className="text-xs font-medium text-sidebar dark:text-heading">
        {row.payload.isPayable ? 'YES' : 'NO'}
      </span>
    )),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('roster', 'Roster', (row) => row.payload.rosterGroupName ?? '—'),
    col.text('date', 'Date', (row) =>
      nowrap(
        !row.toDate || row.fromDate === row.toDate
          ? longDay(row.fromDate)
          : `${longDay(row.fromDate)} – ${longDay(row.toDate)}`,
      ),
    ),
    col.text('count', 'Days', (row) => row.days ?? row.payload.days.length),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields,
  FormDialog: RestDaysForm,
  DetailRows: RestDaysDetail,
}
