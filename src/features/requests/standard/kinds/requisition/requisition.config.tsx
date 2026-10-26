import type { StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { claimFilterFields, money, viewDay } from '../expense/claims.utils'
import { REQUISITION_TYPE_LABELS } from './requisition.constants'
import type { RequisitionPayload } from './requisition.types'
import { RequisitionDetail } from './requisition-detail'
import { RequisitionForm } from './requisition-form'

/**
 * Requisitions (`/requests/requisition`; designed here, no design exists):
 * My / All Requisitions and Approvals. Approval only: the API tells who
 * fulfils it (IT Administrator or Admin Manager authority); nothing is stocked here.
 */
export const requisitionConfig: StandardKindConfig<RequisitionPayload> = {
  kind: 'requisition',
  label: 'Requisition',
  noun: 'Requisition',
  requestsTitle: 'Requisitions',
  approvalsTitle: 'Requisition Approvals',
  scopeLabels: { my: 'My Requisitions', all: 'All Requisitions' },
  approvalViews: ['requested', 'cancellations', 'delegates', 'consents'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('title', 'Title', (row) => row.payload.title, 'min-w-32 whitespace-normal'),
    col.text('type', 'Type', (row) => nowrap(REQUISITION_TYPE_LABELS[row.payload.requisitionType])),
    col.text('neededBy', 'Needed By', (row) => nowrap(viewDay(row.payload.neededByDate))),
    col.text('items', 'Items', (row) => String(row.payload.lines.length)),
    col.text('estimate', 'Estimated Amount', (row) =>
      nowrap(money(row.payload.estimatedAmount, row.payload.currency)),
    ),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('title', 'Title', (row) => row.payload.title, 'min-w-32 whitespace-normal'),
    col.text('neededBy', 'Needed By', (row) => nowrap(viewDay(row.payload.neededByDate))),
    col.text('estimate', 'Estimated Amount', (row) =>
      nowrap(money(row.payload.estimatedAmount, row.payload.currency)),
    ),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields: claimFilterFields,
  FormDialog: RequisitionForm,
  DetailRows: RequisitionDetail,
}
