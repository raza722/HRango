import { createFileRoute, redirect } from '@tanstack/react-router'

/** "Attendance" opens its overview; the sidebar lists the pages under it. */
export const Route = createFileRoute('/_app/attendance/')({
  beforeLoad: () => {
    throw redirect({ to: '/attendance/overview', replace: true })
  },
})
