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
  col.text('type', 'Loan Type', (row: Row) => row.payload.loanTypeName ?? '—', wrap),
  col.text(
    'required',
    'Required Amount',
    (row: Row) => nowrap(pkrShort(row.payload.amountRequested)),
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

/**
 * The Filters popups (4172:61026, 4172:63856, 4180:44986, 4187:79719), cut to
 * what the API filters on: code / name (`q`), location, branch, department,
 * employee, status, the request's dates and (Delegates) the delegator.
 */
function filterFields({
  kind,
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as LoanAdvanceLookups | undefined
  const options = (items: readonly { id: string; name: string }[] | undefined) =>
    (items ?? []).map((item) => ({ value: item.id, label: item.name }))
  const status: FilterField = {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select an Option',
    options: REQUEST_STATUSES.map((value) => ({ value, label: STANDARD_STATUS_META[value].label })),
  }
  const code: FilterField = { kind: 'text', key: 'q', label: 'Code', placeholder: 'Code or name' }
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
      options: options(extra?.locations),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: options(extra?.branches),
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: options(lookups?.departments),
    },
    employeeFilterField(typePermission(kind, 'create'), {
      label: 'Employees',
      placeholder: 'Select Employees',
    }),
  ]
  if (tab === 'approvals' && view === 'delegates') {
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
      code,
      ...dates,
    ]
  }
  return [...where, status, code, ...dates]
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
  // The frames also draw "Consents", with no content designed for it. Cancellations: an
  // approved loan's cancellation walks the cancellation flow (the API's box).
  approvalViews: ['requested', 'delegates', 'cancellations'],
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
