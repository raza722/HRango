import { Link } from '@tanstack/react-router'

import { AttendanceSubLayout } from './attendance-sub-layout'

/** `/attendance/<slug>` that no page answers (an old or mistyped link): back to the menu. */
export function AttendanceSectionPlaceholder() {
  return (
    <AttendanceSubLayout current="logs">
      <section className="rounded-xl bg-card px-6 py-10 text-center shadow-xs">
        <h1 className="text-lg font-medium text-title">Unknown attendance page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a page from the menu, or go to{' '}
          <Link to="/attendance/logs" className="text-primary underline-offset-2 hover:underline">
            Attendance Logs
          </Link>
          .
        </p>
      </section>
    </AttendanceSubLayout>
  )
}
