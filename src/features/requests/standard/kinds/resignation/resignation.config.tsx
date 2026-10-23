import { format, parse } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { ResignationLookups, ResignationPayload } from './resignation.types'
import { ResignationDetail } from './resignation-detail'
import { ResignationForm } from './resignation-form'

/** "Thursday," over "29 Aug 2024", as the request lists draw dates. */
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

function filterFields({ tab, view, lookups }: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as ResignationLookups | undefined
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      options: (lookups?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
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
      key: 'type',
      label: 'Type',
      placeholder: 'Select Type',
      options: (extra?.types ?? []).map((item) => ({ value: item.value, label: item.label })),
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
 * Resignation (section 2697:5532): My Resignation / All Resignations, and
 * Approvals with Requested / Cancellations / Delegates. Built from the
 * design notes; the frames could not be read (see the hand-back report).
 */
export const resignationConfig: StandardKindConfig<ResignationPayload> = {
  kind: 'resignation',
  label: 'Resignation',
  noun: 'Resignation',
  requestsTitle: 'Resignation Requests',
  approvalsTitle: 'Resignation Approvals',
  scopeLabels: { my: 'My Resignation', all: 'All Resignations' },
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('type', 'Type', (row) => nowrap(row.payload.typeLabel)),
    col.text('resignationDate', 'Resignation Date', (row) =>
      twoLineDay(row.payload.resignationDate),
    ),
    col.text('lastWorkingDate', 'Last Working Date', (row) =>
      twoLineDay(row.payload.lastWorkingDate),
    ),
    col.text('notice', 'Notice Period', (row) => nowrap(row.payload.noticePeriod)),
    col.status({}),
  ],
  approvalColumns: (view) =>
    view === 'cancellations'
      ? [
          col.code(),
          col.employee('Employees'),
          col.department(),
          col.text('resignationDate', 'Resignation Date', (row) =>
            twoLineDay(row.payload.resignationDate),
          ),
          col.text('lastWorkingDate', 'Last Working Date', (row) =>
            twoLineDay(row.payload.lastWorkingDate),
          ),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ]
      : [
          col.code(),
          col.employee('Employees'),
          col.department(),
          col.text('type', 'Type', (row) => nowrap(row.payload.typeLabel)),
          col.text('resignationDate', 'Resignation Date', (row) =>
            twoLineDay(row.payload.resignationDate),
          ),
          col.text('lastWorkingDate', 'Last Working Date', (row) =>
            twoLineDay(row.payload.lastWorkingDate),
          ),
          col.text('notice', 'Notice Period', (row) => nowrap(row.payload.noticePeriod)),
          col.authority('Authority'),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ],
  filterFields,
  FormDialog: ResignationForm,
  DetailRows: ResignationDetail,
}
