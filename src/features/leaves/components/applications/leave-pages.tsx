import { getRouteApi } from '@tanstack/react-router'

import { LeaveListPage } from './leave-list-page'

const myLeavesRoute = getRouteApi('/_app/leaves/my-leaves')
const applicationsRoute = getRouteApi('/_app/leaves/applications')

/** `/leaves/my-leaves`: the signed-in person's leave applications. */
export function MyLeavesPage() {
  const search = myLeavesRoute.useSearch()
  const navigate = myLeavesRoute.useNavigate()
  return (
    <LeaveListPage
      scope="my"
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}

/** `/leaves/applications`: everyone's, with Approve/Reject. */
export function LeaveApplicationsPage() {
  const search = applicationsRoute.useSearch()
  const navigate = applicationsRoute.useNavigate()
  return (
    <LeaveListPage
      scope="all"
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
