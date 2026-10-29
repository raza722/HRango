import { getRouteApi, Link } from '@tanstack/react-router'

import type { OvertimeSearch } from '../../overtime-routing'
import { OVERTIME_TABS, type OvertimeTab } from '../../types/overtime.types'
import { overtimeTabClass } from '../../utils/overtime-styles'
import { AttendanceSubLayout } from '../layout/attendance-sub-layout'
import { ApplicationsTab } from './applications-tab'
import { BulkApplicationsTab } from './bulk-applications-tab'
import { BulkOvertimeTab } from './bulk-overtime-tab'
import { MyOvertimeTab } from './my-overtime-tab'
import { OvertimeSettingsTab } from './overtime-settings-tab'
import { PolicyTab } from './policy-tab'

const routeApi = getRouteApi('/_app/attendance/overtime')

const TAB_LABELS: Record<OvertimeTab, string> = {
  my: 'My Overtime',
  applications: 'Applications',
  'bulk-applications': 'Bulk Applications',
  'bulk-overtime': 'Bulk Overtime',
  policy: 'Overtime Policy',
  settings: 'Settings',
}

/** What a tab's content gets: the URL state and a way to change it (the page resets to 1). */
export interface OvertimeTabProps {
  search: OvertimeSearch
  update: (patch: Partial<OvertimeSearch>) => void
}

/**
 * Attendance → Overtime (frames 2785:14902 … 4207:75397): the content card beside the
 * Attendance sub menu, with the inner tabs My Overtime | Applications | Bulk Applications |
 * Bulk Overtime | Overtime Policy | Settings (Poppins Regular 13 #5C5C5C; the current one
 * Medium 14 #17263A under a 2.5px navy bar) and the chosen tab under them. The tab and its
 * filters live in the URL. Overtime is a request type of the API (`/requests/overtime`,
 * approved through `/requests/approvals`); policies and settings are Attendance settings.
 */
export function AttendanceOvertimePage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const update = (patch: Partial<OvertimeSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) })
  }
  const props: OvertimeTabProps = { search, update }

  return (
    <AttendanceSubLayout current="overtime">
      <section aria-label="Overtime" className="rounded-xl bg-card shadow-xs">
        <nav
          aria-label="Overtime"
          className="flex scrollbar-thin gap-6 overflow-x-auto px-4 sm:px-[1.875rem]"
        >
          {OVERTIME_TABS.map((tab) => (
            <Link
              key={tab}
              to="/attendance/overtime"
              search={{ tab }}
              // The default tab's link carries no search once `tab=my` is stripped, and a
              // partial search match would mark it active on every tab.
              activeOptions={{ exact: true }}
              aria-current={search.tab === tab ? 'page' : undefined}
              className={overtimeTabClass}
            >
              {search.tab === tab && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[2.5px] rounded-b-[10px] bg-sidebar dark:bg-primary"
                />
              )}
              {TAB_LABELS[tab]}
            </Link>
          ))}
        </nav>
        <div className="grid gap-4 px-4 pt-7 pb-6 sm:px-[1.875rem]">
          {search.tab === 'my' && <MyOvertimeTab {...props} />}
          {search.tab === 'applications' && <ApplicationsTab {...props} />}
          {search.tab === 'bulk-applications' && <BulkApplicationsTab {...props} />}
          {search.tab === 'bulk-overtime' && <BulkOvertimeTab {...props} />}
          {search.tab === 'policy' && <PolicyTab {...props} />}
          {search.tab === 'settings' && <OvertimeSettingsTab />}
        </div>
      </section>
    </AttendanceSubLayout>
  )
}
