import type { FilterField } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type {
  StandardFilterContext,
  StandardKindConfig,
  StandardRequest,
} from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { StandardPersonCell } from '../../standard-parts'
import { STANDARD_STATUS_META } from '../../standard-styles'
import { listDay, listStamp, pkrShort } from './loan-advances.constants'
import type { LoanAdvanceLookups, LoanAdvancePayload } from './loan-advances.types'
import { LoanAdvancesDecisionFields } from './loan-advances-decision'
import { LoanAdvancesDetail } from './loan-advances-detail'
import { LoanAdvancesForm } from './loan-advances-form'
import { LoanAdvancesSettings } from './loan-advances-settings'

type Row = StandardRequest<LoanAdvancePayload>

/**
 * The lists' columns (frames 4172:56537, 4190:93673, 4190:95964, 4190:98077):
 * the same on My, All, Requested and Delegates. Approving Authority and
 * Request Flow are filled only while the request waits for someone.
 */
const wrap = 'min-w-20 whitespace-normal'
const columns = () => [
  col.code<LoanAdvancePayload>(),
  col.employee<LoanAdvancePayload>('Employees'),
  col.department<LoanAdvancePayload>(),
  // Drawn on two lines ("Thu, 29 Aug" / "2024"), as are the amount headers.
  col.text('date', 'Date', (row: Row) => listStamp(row.createdAt), wrap),
  col.text('requiredDate', 'Required Date', (row: Row) => listDay(row.payload.requiredDate), wrap),
  col.text('type', 'Loan Type', (row: Row) => row.payload.typeName, wrap),
  col.text(
    'required',
    'Required Amount',
    (row: Row) => nowrap(pkrShort(row.payload.requiredAmount)),
    wrap,
  ),
  col.text(
    'approved',
    'Approved Amount',
    (row: Row) => nowrap(pkrShort(row.payload.approvedAmount)),
    wrap,
  ),
  col.text(
    'authority',
    'Approving Authority',
    (row: Row) => row.currentStep?.authority ?? '',
    'min-w-24 whitespace-normal',
  ),
  col.text(
    'next',
    'Request Flow',
    (row: Row) => (row.currentStep ? <StandardPersonCell person={row.currentStep.approver} /> : ''),
    'min-w-32',
  ),
  col.status<LoanAdvancePayload>({}),
]

/** The Filters popups, as drawn for each list (4172:61026, 4172:63856, 4180:44986, 4187:79719). */
function filterFields({
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as LoanAdvanceLookups | undefined
  const people = (lookups?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const names = (values: readonly string[] | undefined) =>
    (values ?? []).map((name) => ({ value: name, label: name }))
  const types = (extra?.types ?? []).map((type) => ({ value: type.id, label: type.name }))
  const employment = (label: string): FilterField => ({
    kind: 'select',
    key: 'employmentStatus',
    label,
    placeholder: `Select ${label}`,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  })
  const status: FilterField = {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select an Option',
    options: REQUEST_STATUSES.map((value) => ({ value, label: STANDARD_STATUS_META[value].label })),
  }
  const code: FilterField = { kind: 'text', key: 'code', label: 'Code', placeholder: 'Code' }
  const range: FilterField = {
    kind: 'range',
    key: 'amount',
    label: 'Range',
    from: 'amountFrom',
    to: 'amountTo',
  }
  const loanType = (label: string): FilterField => ({
    kind: 'select',
    key: 'typeId',
    label,
    placeholder: `Select ${label}`,
    options: types,
  })
  const flow: FilterField = {
    kind: 'select',
    key: 'nextRequesteeId',
    label: 'Request Flow',
    placeholder: 'Select Request Flow',
    options: people,
  }
  const dates: FilterField[] = [
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
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
      placeholder: 'Select Employees',
      options: people,
    },
  ]

  if (tab === 'request' && scope === 'my') {
    return [
      employment('Employee Status'),
      status,
      code,
      range,
      loanType('Advance Loan Type'),
      flow,
      ...dates,
    ]
  }
  if (tab === 'request') {
    return [
      ...where,
      employment('Employment Status'),
      status,
      code,
      range,
      loanType('Advance Loan Type'),
      flow,
      ...dates,
    ]
  }
  if (view === 'delegates') {
    return [
      ...where,
      employment('Employment Status'),
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
      code,
      flow,
      loanType('Loan & Advance Type'),
      ...dates,
    ]
  }
  return [
    ...where,
    employment('Employment Status'),
    status,
    code,
    loanType('Advance Loan Type'),
    flow,
    ...dates,
  ]
}

/**
 * Loan & Advances (section 2697:5532): Requests with My / All, Approvals with
 * Requested / Delegates, the status tabs and Approved / Unapproved, and a
 * Settings tab (Types, Categories, Repayment). The approver fills in the
 * approved amount, payment method and repayment date.
 */
export const loanAdvancesConfig: StandardKindConfig<LoanAdvancePayload> = {
  kind: 'loan-advances',
  label: 'Loan & Advances',
  noun: 'Loan & Advances',
  requestsTitle: 'Loan & Advances',
  approvalsTitle: 'Loan & Advances Approval',
  scopeLabels: { my: 'My Loan & Advances', all: 'All Loan & Advances' },
  // The frames also draw "Consents", with no content designed for it.
  approvalViews: ['requested', 'delegates'],
  statusTabs: true,
  bulk: true,
  settingsTab: { label: 'Settings', Page: LoanAdvancesSettings },
  requestColumns: columns,
  approvalColumns: columns,
  filterFields,
  FormDialog: LoanAdvancesForm,
  DetailRows: LoanAdvancesDetail,
  DecisionFields: LoanAdvancesDecisionFields,
}
