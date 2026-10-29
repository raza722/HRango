import { format, parseISO } from 'date-fns'

import type { FilterField } from '@/features/payroll'

import { typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES, type RequestStatus } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { StandardPersonCell } from '../../standard-parts'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { WorkFromHomePayload } from './work-from-home.types'
import { WorkFromHomeDetail } from './work-from-home-detail'
import { WorkFromHomeForm } from './work-from-home-form'

/** Work From Home says "Completed" where the other types say "Approved". */
const STATUS_LABELS: Partial<Record<RequestStatus, string>> = { completed: 'Completed' }
const statusWord = (status: RequestStatus) =>
  STATUS_LABELS[status] ?? STANDARD_STATUS_META[status].label

/** "Thu, 29 Aug 2024". */
const created = (stamp: string) => format(parseISO(stamp), 'EEE, d MMM yyyy')

function filterFields({
  kind,
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const fields: FilterField[] = [
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
      options: REQUEST_STATUSES.map((value) => ({ value, label: statusWord(value) })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (tab === 'approvals' || scope === 'all') {
    fields.unshift(employeeFilterField(typePermission(kind, 'create')))
  }
  if (tab === 'approvals' && view === 'delegates') {
    fields.splice(1, 0, {
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
 * Work From Home (frames 2697:5533 … 4013:36535): Requests with My / All /
 * Subordinates (the third drawn on one frame: `view=subordinates`, the people
 * who report to you), the status tabs and bulk Approved / Unapproved; Approvals
 * with Requested and Delegates. "Completed" replaces "Approved". The API's type
 * is `work_from_home` (`/requests/work-from-home`).
 */
export const workFromHomeConfig: StandardKindConfig<WorkFromHomePayload> = {
  kind: 'work-from-home',
  label: 'Work From Home',
  noun: 'WFH',
  requestsTitle: 'WFH Requests',
  approvalsTitle: 'WFH Approvals',
  scopeLabels: { my: 'My Requests', all: 'All Requests', subordinates: 'Subordinates' },
  // The API decides a cancellation from its own box (Cancellations).
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: true,
  bulk: true,
  statusLabels: STATUS_LABELS,
  requestColumns: () => [
    col.code(),
    col.employee(),
    col.department(),
    col.text('created', 'Created Date', (row) => nowrap(created(row.createdAt))),
    col.text('count', 'Count', (row) => row.days ?? row.payload.days.length),
    col.status({ statusLabels: STATUS_LABELS }),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee(),
    col.department(),
    col.text('created', 'Created Date', (row) => nowrap(created(row.createdAt))),
    col.text('count', 'Count', (row) => row.days ?? row.payload.days.length),
    // Who decides next; once decided, who decided last.
    col.text(
      'approver',
      'Approver',
      (row) => {
        const person =
          row.currentStep?.approver ??
          row.flow.filter((step) => step.actedBy).at(-1)?.actedBy ??
          row.finalAuthority
        return person ? <StandardPersonCell person={person} /> : '—'
      },
      'min-w-32',
    ),
    col.status({ statusLabels: STATUS_LABELS }),
  ],
  filterFields,
  FormDialog: WorkFromHomeForm,
  DetailRows: WorkFromHomeDetail,
}
