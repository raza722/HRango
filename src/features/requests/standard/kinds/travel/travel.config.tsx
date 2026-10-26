import type { FilterField } from '@/features/payroll'

import { typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { TravelLookups, TravelPayload } from './travel.types'
import { TravelDetail } from './travel-detail'
import { TravelForm } from './travel-form'

/**
 * The Filters popups as drawn, with what the API filters on: My Request
 * (4179:65008) Status, Code, From, To; All Requests (4179:71526, 4189:52596)
 * and Approvals (4182:74488) add Location, Branch, Department and Employees;
 * Delegates (4182:76042) adds the Delegator. The drawn Next Requestee and
 * Employment Status filters are left out: the API has no such filters.
 */
function filterFields({
  kind,
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as TravelLookups | undefined
  const named = (list: readonly { id: string; name: string }[] | undefined) =>
    (list ?? []).map((item) => ({ value: item.id, label: item.name }))
  const status: FilterField = {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select Status Option',
    options: REQUEST_STATUSES.map((value) => ({ value, label: STANDARD_STATUS_META[value].label })),
  }
  // The API searches the code (and the employee's name) with `q`.
  const code: FilterField = { kind: 'text', key: 'q', label: 'Code', placeholder: 'Code' }
  const dates: FilterField[] = [
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (tab === 'request' && scope === 'my') return [status, code, ...dates]

  const where: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: named(extra?.locations),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: named(extra?.branches),
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: named(lookups?.departments),
    },
    employeeFilterField(typePermission(kind, 'create'), { label: 'Employees' }),
  ]
  if (tab === 'request') return [...where, status, code, ...dates]
  if (view !== 'delegates') return [...where, status, code, ...dates]
  return [
    ...where,
    status,
    {
      kind: 'select',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      options: (lookups?.delegators ?? []).map((person) => ({
        value: person.id,
        label: person.name,
      })),
    },
    ...dates,
  ]
}

/**
 * Travel (frames 4163:54986 … 4189:52596 in section 2697:5532): "Travel
 * Request" with My Request / All Requests, the status tabs and Approved /
 * Unapproved; Approvals with Requested, Cancellations and Delegates (the
 * Consents tab is drawn with no content and is left out).
 */
export const travelConfig: StandardKindConfig<TravelPayload> = {
  kind: 'travel',
  label: 'Travel',
  noun: 'Travel',
  requestsTitle: 'Travel Request',
  approvalsTitle: 'Travel Request',
  scopeLabels: { my: 'My Request', all: 'All Requests' },
  // Cancellations: an approved request's cancellation waits there for its approver.
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.nextRequestee('Request Flow'),
    col.authority('Approving Authority'),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.nextRequestee('Next Requestee'),
    col.authority('Approving Authority'),
    // The Approvals frames write an approved request "Completed".
    col.status({ statusLabels: { completed: 'Completed' } }),
  ],
  filterFields,
  FormDialog: TravelForm,
  DetailRows: TravelDetail,
}
