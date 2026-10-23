import { createFileRoute } from '@tanstack/react-router'

import { AttendanceSectionPlaceholder, sectionLabel } from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

/** The Attendance menu entries not built yet (Overtime, Missing Punch). */
export const Route = createFileRoute('/_app/attendance/$section')({
  head: ({ params }) => ({ meta: [{ title: pageTitle(sectionLabel(params.section)) }] }),
  component: AttendanceSectionRoute,
})

function AttendanceSectionRoute() {
  const { section } = Route.useParams()
  return <AttendanceSectionPlaceholder slug={section} />
}
