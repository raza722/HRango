import type { StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { claimFilterFields, money, viewDay } from './claims.utils'
import type { ExpensePayload } from './expense.types'
import { ExpenseDecisionFields } from './expense-decision'
import { ExpenseDetail } from './expense-detail'
import { ExpenseForm } from './expense-form'
import { ExpenseSettings } from './expense-settings'

const claimDates = (row: { fromDate: string | null; toDate: string | null }) =>
  row.fromDate && row.toDate && row.fromDate !== row.toDate
    ? `${viewDay(row.fromDate)} – ${viewDay(row.toDate)}`
    : viewDay(row.fromDate)

/**
 * Expense claims (`/requests/expense`): My Claims / All Claims, Approvals
 * (Requested / Cancellations / Delegates / Consents) and Settings (Expense
 * Categories, Reimbursement pay items). One request carries several claims.
 */
export const expenseConfig: StandardKindConfig<ExpensePayload> = {
  kind: 'expense',
  label: 'Expense',
  noun: 'Expense',
  requestsTitle: 'Expense Claims',
  approvalsTitle: 'Expense Approvals',
  scopeLabels: { my: 'My Claims', all: 'All Claims' },
  approvalViews: ['requested', 'cancellations', 'delegates', 'consents'],
  statusTabs: true,
  bulk: true,
  settingsTab: { label: 'Settings', Page: ExpenseSettings },
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('dates', 'Claim Date', (row) => nowrap(claimDates(row))),
    col.text('claims', 'Claims', (row) => String(row.payload.lines.length)),
    col.text('total', 'Amount', (row) =>
      nowrap(money(row.payload.totalAmount, row.payload.currency)),
    ),
    col.text('approved', 'Approved Amount', (row) =>
      nowrap(money(row.payload.approvedAmount, row.payload.currency)),
    ),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('dates', 'Claim Date', (row) => nowrap(claimDates(row))),
    col.text('claims', 'Claims', (row) => String(row.payload.lines.length)),
    col.text('total', 'Amount', (row) =>
      nowrap(money(row.payload.totalAmount, row.payload.currency)),
    ),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields: claimFilterFields,
  FormDialog: ExpenseForm,
  DetailRows: ExpenseDetail,
  DecisionFields: ExpenseDecisionFields,
}
