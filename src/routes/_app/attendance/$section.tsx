import { createFileRoute } from '@tanstack/react-router'

import { AttendanceSectionPlaceholder, sectionLabel } from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

/** `/attendance/<slug>` that no page answers: a pointer back to the Attendance menu. */
export const Route = createFileRoute('/_app/attendance/$section')({
  head: ({ params }) => ({ meta: [{ title: pageTitle(sectionLabel(params.section)) }] }),
  component: AttendanceSectionPlaceholder,
})
