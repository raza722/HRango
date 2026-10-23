import { format, parse } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import { clock } from '../../../utils/request-format'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { RelaxationPayload } from './relaxation.types'
import { RelaxationDetail } from './relaxation-detail'
import { RelaxationForm } from './relaxation-form'

/** "Thursday," over "29 Aug 2024", as the Relaxation lists draw dates. */
function twoLineDay(date: string) {
  const value = parse(date, 'yyyy-MM-dd', new Date())
  return (
    <span className="whitespace-nowrap">
      {format(value, 'EEEE,')}
      <br />
      {format(value, 'd MMM yyyy')}
    </span>
  )
}

/** "Default Time Slot" over "(10:00 AM - 05:00 PM)", as drawn: the day's slot and its hours. */
function slotCell(payload: RelaxationPayload) {
  return (
    <span className="whitespace-nowrap">
      {payload.slotName}
      <br />({clock(payload.shiftIn)} - {clock(payload.shiftOut)})
    </span>
  )
}

function filterFields({ tab, view, lookups }: StandardFilterContext): readonly FilterField[] {
  const people = (lookups?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
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
      key: 'nextRequesteeId',
      label: 'Next Requestee',
      placeholder: 'Select Next Requestee',
      options: people,
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
 * Relaxation (frames 4223:77542 … 4236:94493, also spelled "Releaxation"):
 * Requests with My / All, Approvals with Requested / Cancellations /
 * Delegates. Approving needs "Reason for Approval", so there is no bulk
 * Approved / Unapproved (a bulk approval has no reason to send).
 */
export const relaxationConfig: StandardKindConfig<RelaxationPayload> = {
  kind: 'relaxation',
  label: 'Relaxation',
  noun: 'Relaxation',
  requestsTitle: 'Relaxation Requests',
  approvalsTitle: 'Relaxation Approvals',
  scopeLabels: { my: 'My Requests', all: 'All Requests' },
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: false,
  bulk: false,
  approveNeedsRemarks: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('slot', 'Time Slot', (row) => slotCell(row.payload)),
    col.text('date', 'Date', (row) => twoLineDay(row.payload.date)),
    col.text('start', 'Start Time', (row) => nowrap(clock(row.payload.startTime))),
    col.text('end', 'End Time', (row) => nowrap(clock(row.payload.endTime))),
    col.text('duration', 'Duration', (row) => nowrap(row.payload.duration)),
    col.nextRequestee('Next Requestee'),
    col.status({}),
  ],
  approvalColumns: (view) =>
    view === 'cancellations'
      ? [
          col.code(),
          col.employee('Employees'),
          col.department(),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ]
      : [
          col.code(),
          col.employee('Employees'),
          col.text('slot', 'Time Slots', (row) => slotCell(row.payload)),
          col.department(),
          col.text('date', 'Date', (row) => twoLineDay(row.payload.date)),
          col.text('time', 'Time', (row) => (
            <span className="whitespace-nowrap">
              {clock(row.payload.startTime)} -
              <br />
              {clock(row.payload.endTime)}
            </span>
          )),
          col.text('duration', 'Duration', (row) => nowrap(row.payload.duration)),
          col.authority('Authority'),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ],
  filterFields,
  FormDialog: RelaxationForm,
  DetailRows: RelaxationDetail,
}
