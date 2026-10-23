import { format, parse } from 'date-fns'

import { type FilterField, formatAmount } from '@/features/payroll'

import { REQUEST_STATUSES } from '../../../types/requests.types'
import type {
  StandardFilterContext,
  StandardKindConfig,
  StandardRequest,
} from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { STANDARD_STATUS_META } from '../../standard-styles'
import type { PromotionLookups, PromotionPayload } from './promotion.types'
import { PromotionDetail } from './promotion-detail'
import { PromotionForm } from './promotion-form'

/** "29 Aug 2024": short enough for the list's many columns. */
const shortDay = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'd MMM yyyy')

type Row = StandardRequest<PromotionPayload>

/** The new designation, with the grade and level (and Demotion) under it. */
const designationCell = (row: Row) => (
  <span className="grid">
    <span>{row.payload.designation}</span>
    <span className="text-[0.6875rem] whitespace-nowrap">
      {row.payload.grade} · {row.payload.level}
    </span>
    {row.payload.demotion && (
      <span className="text-[0.6875rem] text-[#D83838] dark:text-red-300">Demotion</span>
    )}
  </span>
)

/** The new salary, and the previous one under it. */
const salaryCell = (row: Row) => (
  <span className="grid whitespace-nowrap">
    <span>{formatAmount(row.payload.salary)}</span>
    <span className="text-[0.6875rem]">from {formatAmount(row.payload.previousSalary)}</span>
  </span>
)

function filterFields({ tab, view, lookups }: StandardFilterContext): readonly FilterField[] {
  const extra = lookups?.extra as PromotionLookups | undefined
  const people = (lookups?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const list = (values: readonly string[] | undefined) =>
    (values ?? []).map((value) => ({ value, label: value }))
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
      options: list(lookups?.departments),
    },
    {
      kind: 'select',
      key: 'designation',
      label: 'Designation',
      placeholder: 'Select Designation',
      options: list(extra?.designations),
    },
    {
      kind: 'select',
      key: 'grade',
      label: 'Grade',
      placeholder: 'Select Grade',
      options: list(extra?.grades),
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
 * Promotion (frames 4195:109156 … 4206:127833, built from the design notes:
 * the frames could not be read when this was built, so the columns and
 * filters still need checking against them). "Promotion Requests" is one list
 * of everyone's requests (HR makes them for the employee), with the status
 * tabs and Approved / Unapproved; Approvals has Requested and Delegates. The
 * popups the frames title "Loan & Advances Request View / Approve/Reject" are
 * titled Promotion here.
 */
export const promotionConfig: StandardKindConfig<PromotionPayload> = {
  kind: 'promotion',
  label: 'Promotion',
  noun: 'Promotion',
  requestsTitle: 'Promotion Requests',
  approvalsTitle: 'Promotion Approvals',
  approvalViews: ['requested', 'delegates'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('designation', 'Designation', designationCell, 'whitespace-normal'),
    col.text('salary', 'Salary', salaryCell),
    col.text('effective', 'Effective Date', (row) => nowrap(shortDay(row.payload.effectiveDate))),
    col.status({}),
  ],
  // Department and Effective Date are in the Approve popup; with them the list scrolls at 1440.
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.text('designation', 'Designation', designationCell, 'whitespace-normal'),
    col.text('salary', 'Salary', salaryCell),
    col.nextRequestee('Next Requestee'),
    col.status({}),
  ],
  filterFields,
  FormDialog: PromotionForm,
  DetailRows: PromotionDetail,
}
