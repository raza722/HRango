import { clock } from '../../../utils/request-format'
import type { StandardKindConfig } from '../../standard.types'
import { nowrap, standardColumns as col } from '../../standard-columns'
import { durationText, hm } from '../relaxation/time-window'
import { timeWindowFilterFields } from '../relaxation/time-window-filters'
import { TimeRange, TwoLineDay } from '../relaxation/time-window-parts'
import type { OfficialVisitPayload } from './official-visits.types'
import { OfficialVisitDetail } from './official-visits-detail'
import { OfficialVisitForm } from './official-visits-form'

/**
 * Official Visits: the menu's placeholder, built in the style of Relaxation on
 * the API's `official_visit` type. Requests with My / All; Approvals with
 * Requested / Cancellations / Delegates / Consents, the status tabs and bulk
 * Approved / Unapproved (no approval remarks are required).
 */
export const officialVisitsConfig: StandardKindConfig<OfficialVisitPayload> = {
  kind: 'official-visits',
  label: 'Official Visits',
  noun: 'Official Visit',
  requestsTitle: 'Official Visit Requests',
  approvalsTitle: 'Official Visit Approvals',
  scopeLabels: { my: 'My Requests', all: 'All Requests' },
  approvalViews: ['requested', 'cancellations', 'delegates', 'consents'],
  statusTabs: true,
  bulk: true,
  requestColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('date', 'Date', (row) => <TwoLineDay date={row.payload.windowDate} />),
    col.text('start', 'Start Time', (row) => nowrap(clock(hm(row.payload.startTime)))),
    col.text('end', 'End Time', (row) => nowrap(clock(hm(row.payload.endTime)))),
    col.text('duration', 'Duration', (row) => nowrap(durationText(row.payload.durationMinutes))),
    col.text('purpose', 'Purpose', (row) => row.reason ?? '—', 'min-w-40 whitespace-normal'),
    col.nextRequestee('Next Requestee'),
    col.status({}),
  ],
  approvalColumns: () => [
    col.code(),
    col.employee('Employees'),
    col.department(),
    col.text('date', 'Date', (row) => <TwoLineDay date={row.payload.windowDate} />),
    col.text('time', 'Time', (row) => <TimeRange details={row.payload} />),
    col.text('duration', 'Duration', (row) => nowrap(durationText(row.payload.durationMinutes))),
    col.authority('Authority'),
    col.nextRequestee('Request Flow'),
    col.status({}),
  ],
  filterFields: timeWindowFilterFields,
  FormDialog: OfficialVisitForm,
  DetailRows: OfficialVisitDetail,
}
