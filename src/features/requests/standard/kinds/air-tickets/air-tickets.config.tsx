import type { StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { claimFilterFields, money, viewDay } from '../expense/claims.utils'
import type { AirTicketPayload } from './air-tickets.types'
import { AirTicketsDecisionFields } from './air-tickets-decision'
import { AirTicketsDetail } from './air-tickets-detail'
import { AirTicketsForm } from './air-tickets-form'

const route = (row: { payload: AirTicketPayload }) =>
  row.payload.fromPlace || row.payload.toPlace
    ? `${row.payload.fromPlace ?? '—'} → ${row.payload.toPlace ?? '—'}`
    : '—'

/**
 * Air ticket claims (`/requests/air-ticket`): My Claims / All Claims and
 * Approvals. An approved claim is paid through payroll under the air ticket
 * reimbursement pay item (Expense → Settings → Reimbursement).
 */
export const airTicketsConfig: StandardKindConfig<AirTicketPayload> = {
  kind: 'air-tickets',
  label: 'Air Tickets',
  noun: 'Air Ticket',
  requestsTitle: 'Air Ticket Claims',
  approvalsTitle: 'Air Ticket Approvals',
  scopeLabels: { my: 'My Claims', all: 'All Claims' },
  approvalViews: ['requested', 'cancellations', 'delegates', 'consents'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('title', 'Title', (row) => row.payload.title, 'min-w-32 whitespace-normal'),
    col.text('travelDate', 'Travel Date', (row) => nowrap(viewDay(row.payload.travelDate))),
    col.text('route', 'From / To', (row) => nowrap(route(row))),
    col.text('amount', 'Amount', (row) => nowrap(money(row.payload.amount, row.payload.currency))),
    col.text('approved', 'Approved Amount', (row) =>
      nowrap(money(row.payload.approvedAmount, row.payload.currency)),
    ),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('title', 'Title', (row) => row.payload.title, 'min-w-32 whitespace-normal'),
    col.text('travelDate', 'Travel Date', (row) => nowrap(viewDay(row.payload.travelDate))),
    col.text('amount', 'Amount', (row) => nowrap(money(row.payload.amount, row.payload.currency))),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields: claimFilterFields,
  FormDialog: AirTicketsForm,
  DetailRows: AirTicketsDetail,
  DecisionFields: AirTicketsDecisionFields,
}
