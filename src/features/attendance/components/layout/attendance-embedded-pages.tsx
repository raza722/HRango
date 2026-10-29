import { STANDARD_CONFIGS, StandardRequestsPage, type StandardSearch } from '@/features/requests'
import {
  type SchedulingSearch,
  type SchedulingSearchUpdate,
  SchedulingView,
} from '@/features/scheduling'

import type { OverviewSearch } from '../../routing'
import { AttendanceInsightsView } from '../insights/attendance-insights-view'
import type { OverviewSearchUpdate } from '../overview/attendance-overview-page'
import { AttendanceSubLayout } from './attendance-sub-layout'

/*
 * The Attendance sub menu's Attendance Insights, Scheduling and Official Visits open their
 * pages beside the sub menu, like Overtime, Attendance Logs and Settings, instead of leaving
 * for the sidebar's Attendance Overview, Scheduling or Requests → Official Visits. No frame
 * draws them there, so they take the Attendance Logs look: one white card with the title and
 * its buttons, a grey filter band and a compact table. Their URL state lives under
 * `/attendance/…`; the sidebar's pages keep their drawn layouts.
 */

/** Attendance Insights: the month per person, from the overview's data. */
export function AttendanceInsightsPage({
  search,
  onSearch,
}: {
  search: OverviewSearch
  onSearch: OverviewSearchUpdate
}) {
  return (
    <AttendanceSubLayout current="insights">
      <AttendanceInsightsView search={search} onSearch={onSearch} />
    </AttendanceSubLayout>
  )
}

/** Scheduling beside the sub menu: the scheduling board in one Logs-style card. */
export function AttendanceSchedulingPage({
  search,
  onSearch,
}: {
  search: SchedulingSearch
  onSearch: SchedulingSearchUpdate
}) {
  return (
    <AttendanceSubLayout current="scheduling">
      <SchedulingView search={search} onSearch={onSearch} variant="sub-menu" />
    </AttendanceSubLayout>
  )
}

/** Official Visits beside the sub menu: the request type's Request / Approvals pages. */
export function AttendanceOfficialVisitsPage({
  search,
  onSearch,
}: {
  search: StandardSearch
  onSearch: (patch: Partial<StandardSearch>) => void
}) {
  // The registry is partial by type; Official Visits is always registered.
  const config = STANDARD_CONFIGS['official-visits']
  return (
    <AttendanceSubLayout current="official-visits">
      {config && <StandardRequestsPage config={config} search={search} onSearch={onSearch} />}
    </AttendanceSubLayout>
  )
}
