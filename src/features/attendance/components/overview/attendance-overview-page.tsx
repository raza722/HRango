import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'
import { ApiError } from '@/lib/api-error'

import { attendanceApi } from '../../api/attendance.api'
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
    ...(search.departmentId ? { departmentId: search.departmentId } : {}),
  }
}

/**
 * Attendance Overview: everyone's month at a glance. All / Subordinates, the
 * legend of day states, Employee Status / Department / Month / Year filters
 * (and Export), and a grid with the totals and one column per processed day.
 */
export function AttendanceOverviewPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [highlight, setHighlight] = useState<DayStatus | null>(null)
  const [openDay, setOpenDay] = useState<DayKey | null>(null)
  const month = search.month ?? today.slice(0, 7)
  const params = overviewParams(search, month)
  const overview = useAttendanceOverview(params)

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
  const filterKey = [search.status, search.departmentId, month].join('|')

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
        onExport={async () => {
          try {
            await attendanceApi.exportOverview(params)
          } catch (error) {
            toast.error(
              error instanceof ApiError ? error.message : 'Could not export the overview.',
            )
          }
        }}
        onApply={(values) => {
          void update({
            status: values.status,
            departmentId: values.departmentId,
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
