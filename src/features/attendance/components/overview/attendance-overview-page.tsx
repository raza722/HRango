import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'

import { OVERVIEW_PAGE_SIZE } from '../../constants'
import { useAttendanceOverview } from '../../hooks/use-attendance'
import type { OverviewSearch } from '../../routing'
import type { DayKey, DayStatus, OverviewParams } from '../../types/attendance.types'
import { TimeSheetViewDialog } from '../dialogs/time-sheet-view-dialog'
import { OverviewFilters } from './overview-filters'
import { OverviewHeader } from './overview-header'
import { OverviewTable } from './overview-table'

const routeApi = getRouteApi('/_app/attendance/overview')

function overviewParams(search: OverviewSearch, month: string): OverviewParams {
  return {
    scope: search.scope,
    month,
    page: search.page,
    pageSize: OVERVIEW_PAGE_SIZE,
    ...(search.q ? { search: search.q } : {}),
    ...(search.status !== 'all' ? { status: search.status } : {}),
    ...(search.employeeId ? { employeeId: search.employeeId } : {}),
    ...(search.department ? { department: search.department } : {}),
  }
}

/**
 * Attendance Overview: everyone's month at a glance. All / Subordinates, the
 * legend of day states, Employee Status / Name / Department / Month / Year
 * filters, and a grid with the totals and one column per day.
 */
export function AttendanceOverviewPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [highlight, setHighlight] = useState<DayStatus | null>(null)
  const [openDay, setOpenDay] = useState<DayKey | null>(null)
  const month = search.month ?? today.slice(0, 7)
  const overview = useAttendanceOverview(overviewParams(search, month))

  const update = (patch: Partial<OverviewSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })

  // Search box: the URL (and the request) follow when typing pauses.
  const q = search.q ?? ''
  const [text, setText] = useState(q)
  const [urlQuery, setUrlQuery] = useState(q)
  if (q !== urlQuery) {
    setUrlQuery(q)
    if (q !== text.trim()) setText(q)
  }
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(searchTimer.current)
    },
    [],
  )

  const meta = overview.data?.meta
  const rows = overview.data?.data ?? []
  // Remount the filters when the URL changes them (back / forward).
  const filterKey = [search.status, search.employeeId, search.department, month].join('|')

  return (
    <PageContainer>
      <OverviewHeader
        scope={search.scope}
        onScopeChange={(scope) => {
          void update({ scope, page: 1 })
        }}
        searchText={text}
        onSearchChange={(value) => {
          setText(value)
          window.clearTimeout(searchTimer.current)
          searchTimer.current = window.setTimeout(() => {
            void update({ q: value.trim() || undefined, page: 1 }, true)
          }, 300)
        }}
        highlight={highlight}
        onHighlightChange={setHighlight}
      />

      <OverviewFilters
        key={filterKey}
        search={search}
        month={month}
        onApply={(values) => {
          void update({
            status: values.status,
            employeeId: values.employeeId,
            department: values.department,
            month: values.month === today.slice(0, 7) ? undefined : values.month,
            page: 1,
          })
        }}
      />

      <section
        aria-label="Attendance grid"
        className="grid gap-4 overflow-hidden rounded-xl bg-card pb-4 shadow-xs"
      >
        {overview.isError ? (
          <ErrorState
            title="Could not load the attendance overview"
            message="Check your connection and try again."
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <OverviewTable
            rows={rows}
            days={overview.data?.days ?? []}
            today={today}
            isLoading={overview.isPending}
            isFetching={overview.isFetching}
            highlight={highlight}
            onOpenDay={(employeeId, date) => {
              setOpenDay({ employeeId, date })
            }}
          />
        )}
        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
            <p className="text-sm text-muted-foreground">
              Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} employees
            </p>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              disabled={overview.isFetching}
              onPageChange={(page) => {
                void update({ page })
              }}
            />
          </div>
        )}
      </section>

      {openDay && (
        <TimeSheetViewDialog
          dayKey={openDay}
          onClose={() => {
            setOpenDay(null)
          }}
        />
      )}
    </PageContainer>
  )
}
