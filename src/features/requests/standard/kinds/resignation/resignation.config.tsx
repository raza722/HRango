import { format, parse } from 'date-fns'

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
import { RESIGNATION_TYPE_LABELS } from './resignation.lookups'
import type { ResignationPayload } from './resignation.types'
import { noticePeriod } from './resignation.utils'
import { ResignationDecisionFields } from './resignation-decision'
import { ResignationDetail } from './resignation-detail'
import { ResignationForm } from './resignation-form'

type Row = StandardRequest<ResignationPayload>

/** "Thursday," over "29 Aug 2024", as the request lists draw dates. */
function twoLineDay(date: string | null) {
  if (!date) return '—'
  const value = parse(date, 'yyyy-MM-dd', new Date())
  return (
    <span className="whitespace-nowrap">
      {format(value, 'EEEE,')}
      <br />
      {format(value, 'd MMM yyyy')}
    </span>
  )
}

const typeLabel = (row: Row) => RESIGNATION_TYPE_LABELS[row.payload.resignationType]

/** The Filters popup, cut to what the API filters on (Type is not). */
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
    { kind: 'text', key: 'q', label: 'Code', placeholder: 'Code or name' },
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

/**
 * Resignation (section 2697:5532): My Resignation / All Resignations, and
 * Approvals with Requested / Cancellations / Delegates. The approver may set
 * the last working date, whether notice is served and the notice period.
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
    col.text('type', 'Type', (row) => nowrap(typeLabel(row))),
    col.text('resignationDate', 'Resignation Date', (row) =>
      twoLineDay(row.payload.resignationDate),
    ),
    col.text('lastWorkingDate', 'Last Working Date', (row) =>
      twoLineDay(row.payload.lastWorkingDate),
    ),
    col.text('notice', 'Notice Period', (row) => nowrap(noticePeriod(row.payload))),
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
          col.text('type', 'Type', (row) => nowrap(typeLabel(row))),
          col.text('resignationDate', 'Resignation Date', (row) =>
            twoLineDay(row.payload.resignationDate),
          ),
          col.text('lastWorkingDate', 'Last Working Date', (row) =>
            twoLineDay(row.payload.lastWorkingDate),
          ),
          col.text('notice', 'Notice Period', (row) => nowrap(noticePeriod(row.payload))),
          col.authority('Authority'),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ],
  filterFields,
  FormDialog: ResignationForm,
  DetailRows: ResignationDetail,
  DecisionFields: ResignationDecisionFields,
}
