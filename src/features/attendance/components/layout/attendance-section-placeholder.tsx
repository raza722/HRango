import { Link } from '@tanstack/react-router'

import { PLANNED_SECTIONS, type PlannedSection } from './attendance-sections'
import { AttendanceSubLayout } from './attendance-sub-layout'

/** An Attendance menu entry that is not built yet. */
export function AttendanceSectionPlaceholder({ slug }: { slug: string }) {
  if (!(slug in PLANNED_SECTIONS)) {
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
  const key = slug as PlannedSection
  const { label, icon: Icon, planned } = PLANNED_SECTIONS[key]
  return (
    <AttendanceSubLayout current={key}>
      <section className="grid justify-items-center gap-3 rounded-xl bg-card px-6 py-12 text-center shadow-xs">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-sidebar dark:text-heading">
          <Icon className="size-7" />
        </span>
        <h1 className="text-xl font-medium text-title">{label}</h1>
        <p className="max-w-md text-sm text-muted-foreground">Coming next. {planned}</p>
      </section>
    </AttendanceSubLayout>
  )
}
