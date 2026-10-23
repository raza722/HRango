import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext, StandardKindConfig } from '../../standard.types'
import { standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { TravelLookups, TravelPayload } from './travel.types'
import { TravelDetail } from './travel-detail'
import { TravelForm } from './travel-form'

/**
 * The Filters popups as drawn: My Request (4179:65008) Status, Code, Next
 * Requestee, From, To; All Requests (4179:71526, 4189:52596) and Approvals
 * (4182:74488) add Location, Branch, Department and Employees; Delegates
 * (4182:76042) adds Employment Status and Delegator.
 */
function filterFields({
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as TravelLookups | undefined
  const people = (lookups?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const names = (list: readonly string[] | undefined) =>
    (list ?? []).map((name) => ({ value: name, label: name }))
  const status: FilterField = {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select Status Option',
    options: REQUEST_STATUSES.map((value) => ({ value, label: STANDARD_STATUS_META[value].label })),
  }
  const code: FilterField = { kind: 'text', key: 'code', label: 'Code', placeholder: 'Code' }
  const next = (label: string): FilterField => ({
    kind: 'select',
    key: 'nextRequesteeId',
    label,
    placeholder: 'Select Next Requestee',
    options: people,
  })
  const dates: FilterField[] = [
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (tab === 'request' && scope === 'my') return [status, code, next('Next Requestee'), ...dates]

  const where: FilterField[] = [
    {
      kind: 'select',
      key: 'location',
      label: 'Location',
      placeholder: 'Select Location',
      options: names(extra?.locations),
    },
    {
      kind: 'select',
      key: 'branch',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: names(extra?.branches),
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: names(lookups?.departments),
    },
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      options: people,
    },
  ]
  if (tab === 'request') return [...where, status, code, next('Next Requestee'), ...dates]
  if (view !== 'delegates') return [...where, status, next('Request Flow'), ...dates]
  return [
    ...where,
    {
      kind: 'select',
      key: 'employmentStatus',
      label: 'Employment Status',
      placeholder: 'Select Employment Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    status,
    {
      kind: 'select',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      options: (lookups?.delegators ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
    },
    next('Next Requestee'),
    ...dates,
  ]
}

/**
 * Travel (frames 4163:54986 … 4189:52596 in section 2697:5532): "Travel
 * Request" with My Request / All Requests, the status tabs and Approved /
 * Unapproved; Approvals with Requested and Delegates (the Consents tab is drawn
 * with no content and is left out).
 */
export const travelConfig: StandardKindConfig<TravelPayload> = {
  kind: 'travel',
  label: 'Travel',
  noun: 'Travel',
  requestsTitle: 'Travel Request',
  approvalsTitle: 'Travel Request',
  scopeLabels: { my: 'My Request', all: 'All Requests' },
  approvalViews: ['requested', 'delegates'],
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
