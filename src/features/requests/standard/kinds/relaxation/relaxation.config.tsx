import { clock } from '../../../utils/request-format'
import type { StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import type { RelaxationPayload } from './relaxation.types'
import { RelaxationDetail } from './relaxation-detail'
import { RelaxationForm } from './relaxation-form'
import { durationText, hm } from './time-window'
import { timeWindowFilterFields } from './time-window-filters'
import { SlotCell, TimeRange, TwoLineDay } from './time-window-parts'

/**
 * Relaxation (frames 4223:77542 … 4236:94493, also spelled "Releaxation"):
 * Requests with My / All, Approvals with Requested / Cancellations /
 * Delegates. Approving needs "Reason for Approval" (the API refuses an
 * approval without remarks), so there is no bulk Approved / Unapproved.
 */
export const relaxationConfig: StandardKindConfig<RelaxationPayload> = {
  kind: 'relaxation',
  label: 'Relaxation',
  noun: 'Relaxation',
  requestsTitle: 'Relaxation Requests',
  approvalsTitle: 'Relaxation Approvals',
  scopeLabels: { my: 'My Requests', all: 'All Requests' },
  approvalViews: ['requested', 'cancellations', 'delegates'],
  statusTabs: false,
  bulk: false,
  approveNeedsRemarks: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('slot', 'Time Slot', (row) => <SlotCell details={row.payload} />),
    col.text('date', 'Date', (row) => <TwoLineDay date={row.payload.windowDate} />),
    col.text('start', 'Start Time', (row) => nowrap(clock(hm(row.payload.startTime)))),
    col.text('end', 'End Time', (row) => nowrap(clock(hm(row.payload.endTime)))),
    col.text('duration', 'Duration', (row) => nowrap(durationText(row.payload.durationMinutes))),
    col.nextRequestee('Next Requestee'),
    col.status({}),
  ],
  approvalColumns: (view) =>
    view === 'cancellations'
      ? [
          col.code(),
          col.employee('Employees'),
          col.department(),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ]
      : [
          col.code(),
          col.employee('Employees'),
          col.text('slot', 'Time Slots', (row) => <SlotCell details={row.payload} />),
          col.department(),
          col.text('date', 'Date', (row) => <TwoLineDay date={row.payload.windowDate} />),
          col.text('time', 'Time', (row) => <TimeRange details={row.payload} />),
          col.text('duration', 'Duration', (row) =>
            nowrap(durationText(row.payload.durationMinutes)),
          ),
          col.authority('Authority'),
          col.nextRequestee('Request Flow'),
          col.status({}),
        ],
  filterFields: timeWindowFilterFields,
  FormDialog: RelaxationForm,
  DetailRows: RelaxationDetail,
}
