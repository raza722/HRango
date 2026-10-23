import { format, parse } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { RestDayLookups, RestDayPayload } from './rest-days.types'
import { RestDaysDetail } from './rest-days-detail'
import { RestDaysForm } from './rest-days-form'

/** "Thursday, 29 Aug 2024", as the lists write dates. */
const longDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'EEEE, d MMM yyyy')

function filterFields({ tab, view, lookups }: StandardFilterContext): readonly FilterField[] {
  const people = (lookups?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const extra = lookups?.extra as RestDayLookups | undefined
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      options: people,
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups?.departments ?? []).map((name) => ({ value: name, label: name })),
    },
    {
      kind: 'select',
      key: 'rosterGroupId',
      label: 'Roster',
      placeholder: 'Select Roster',
      options: (extra?.rosters ?? []).map((item) => ({ value: item.id, label: item.title })),
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
 * status tabs over these lists.
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
    col.text('rosters', 'Rosters', (row) => row.payload.rosterTitle),
    col.text('shift', 'Shift', (row) => row.payload.shift, 'min-w-44 whitespace-normal'),
    col.text('from', 'Date (from)', (row) => nowrap(longDay(row.payload.from))),
    col.text('to', 'Date (to)', (row) => nowrap(longDay(row.payload.to))),
    col.text('payable', 'Payable', (row) => (
      <span className="text-xs font-medium text-sidebar dark:text-heading">
        {row.payload.payable ? 'YES' : 'NO'}
      </span>
    )),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('slot', 'Time Slots', (row) => row.payload.shift, 'min-w-44 whitespace-normal'),
    col.text('date', 'Date', (row) =>
      nowrap(
        row.payload.from === row.payload.to
          ? longDay(row.payload.from)
          : `${longDay(row.payload.from)} – ${longDay(row.payload.to)}`,
      ),
    ),
    col.text('time', 'Time', (row) => nowrap(row.payload.time)),
    col.text('duration', 'Duration', (row) => nowrap(row.payload.duration)),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields,
  FormDialog: RestDaysForm,
  DetailRows: RestDaysDetail,
}
