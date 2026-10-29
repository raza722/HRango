import { useEffect, useId, useRef, useState } from 'react'
import { format, parse } from 'date-fns'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { DownloadCircleIcon } from '@/components/icons/attendance-menu-icons'
import { EmployeeAvatar, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { attendanceApi } from '../../api/attendance.api'
import { DAY_STATUS_META, EMPLOYEE_STATUS_OPTIONS, MONTH_NAMES } from '../../constants'
import { useAttendanceOverview } from '../../hooks/use-attendance'
import { useOrgLookup } from '../../hooks/use-attendance-settings'
import type { OverviewSearch } from '../../routing'
import {
  DAY_STATUSES,
  type DayKey,
  type DayStatus,
  OVERVIEW_SCOPES,
  type OverviewRow,
} from '../../types/attendance.types'
import { overviewParams } from '../../utils/overview-params'
import {
  outlineButtonClass,
  pageTitleClass,
  personCodeClass,
  personNameClass,
} from '../../utils/settings-styles'
import { TimeSheetViewDialog } from '../dialogs/time-sheet-view-dialog'
import type { OverviewSearchUpdate } from '../overview/attendance-overview-page'
import { FilterSelect } from '../shared/filter-select'
import { StatusIcon } from '../shared/status-badges'

const SCOPE_LABELS: Record<(typeof OVERVIEW_SCOPES)[number], string> = {
  all: 'All employees',
  subordinates: 'My subordinates',
}

/** The month's totals shown before the days, in the overview's order. */
const TOTALS = [
  { key: 'totalDays', label: 'Total Days' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'leave', label: 'Leave' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'lateArrival', label: 'Late' },
] as const satisfies readonly { key: keyof OverviewRow['totals']; label: string }[]

const headCell =
  'h-10 bg-muted px-3 text-left text-[0.6875rem] font-medium whitespace-nowrap text-title'
const bodyCell = 'h-11 border-b px-3 text-[0.6875rem] text-grey'
const stickyFirst =
  'sticky left-0 z-10 w-44 min-w-44 shadow-[1px_0_0_0_var(--color-border)] sm:w-52 sm:min-w-52'

/**
 * Attendance sub menu → Attendance Insights: the overview's data (`GET /attendance/overview`)
 * as one card in the style of Attendance Logs: the title with Download, a grey filter band
 * (whose attendance, search, employee status, department, month, year) that applies at once,
 * the day states as small chips that highlight a state, and a compact table of the month per
 * person (totals, then one column per day). A day opens its time sheet. No frame draws this
 * page; the sidebar's Attendance Overview keeps the drawn layout.
 */
export function AttendanceInsightsView({
  search,
  onSearch,
}: {
  search: OverviewSearch
  onSearch: OverviewSearchUpdate
}) {
  const searchId = useId()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [highlight, setHighlight] = useState<DayStatus | null>(null)
  const [openDay, setOpenDay] = useState<DayKey | null>(null)
  const [exporting, setExporting] = useState(false)
  const canExport = useCan('attendance.overview.export')
  const departments = useOrgLookup('departments')

  const month = search.month ?? today.slice(0, 7)
  const [year = '', monthNumber = ''] = month.split('-')
  const params = overviewParams(search, month)
  const overview = useAttendanceOverview(params)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => String(thisYear - 3 + index))

  const update = (patch: Partial<OverviewSearch>, replace = false) =>
    onSearch({ ...patch, page: patch.page ?? 1 }, replace)
  const setMonth = (next: string) => {
    void update({ month: next === today.slice(0, 7) ? undefined : next })
  }

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
  const days = overview.data?.days ?? []
  const monthLabel = format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy')
  const columnCount = 1 + TOTALS.length + days.length

  return (
    <section
      aria-labelledby="attendance-insights-title"
      className="grid min-w-0 gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="attendance-insights-title" className={pageTitleClass}>
          Attendance Insights
        </h1>
        {canExport && (
          <Button
            variant="outline"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              attendanceApi
                .exportOverview(params)
                .catch((error: unknown) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not download the month.',
                  )
                })
                .finally(() => {
                  setExporting(false)
                })
            }}
            className={outlineButtonClass}
          >
            <DownloadCircleIcon className="size-5" /> Download
          </Button>
        )}
      </div>

      <div className="@container grid gap-3 rounded-md bg-muted/50 p-3">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3">
          <FilterSelect
            label="Show"
            showLabel
            options={OVERVIEW_SCOPES.map((scope) => ({ value: scope, label: SCOPE_LABELS[scope] }))}
            value={search.scope}
            onChange={(scope) => {
              const picked = OVERVIEW_SCOPES.find((item) => item === scope)
              if (picked) void update({ scope: picked })
            }}
          />
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={searchId} className="text-sm font-medium text-heading">
              Employee
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                id={searchId}
                type="search"
                placeholder="Name or code"
                value={text}
                onChange={(event) => {
                  const value = event.target.value
                  setText(value)
                  window.clearTimeout(searchTimer.current)
                  searchTimer.current = window.setTimeout(() => {
                    void update({ q: value.trim() || undefined }, true)
                  }, 300)
                }}
                className="bg-card pl-9 sm:pl-9"
              />
            </div>
          </div>
          <FilterSelect
            label="Employee Status"
            showLabel
            options={EMPLOYEE_STATUS_OPTIONS}
            value={search.status}
            onChange={(status) => {
              const picked = EMPLOYEE_STATUS_OPTIONS.find((option) => option.value === status)
              void update({ status: picked?.value ?? 'all' })
            }}
          />
          <FilterSelect
            label="Department"
            showLabel
            allLabel="All departments"
            options={(departments.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
            value={search.departmentId}
            onChange={(departmentId) => {
              void update({ departmentId })
            }}
          />
          <FilterSelect
            label="Month"
            showLabel
            options={MONTH_NAMES.map((name, index) => ({
              value: String(index + 1).padStart(2, '0'),
              label: name,
            }))}
            value={monthNumber}
            onChange={(picked) => {
              if (picked) setMonth(`${year}-${picked}`)
            }}
          />
          <FilterSelect
            label="Year"
            showLabel
            options={years.map((value) => ({ value, label: value }))}
            value={year}
            onChange={(picked) => {
              if (picked) setMonth(`${picked}-${monthNumber}`)
            }}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <ul
          aria-label="Day states. Choose one to highlight it in the table."
          className="flex flex-wrap gap-2"
        >
          {DAY_STATUSES.map((status) => {
            const active = highlight === status
            const label = DAY_STATUS_META[status].legendLabel ?? DAY_STATUS_META[status].label
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setHighlight(active ? null : status)
                  }}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.6875rem] font-medium text-title transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
                    active ? 'border-sidebar bg-sidebar/10 dark:border-primary' : 'border-border',
                    highlight !== null && !active && 'opacity-60',
                  )}
                >
                  <StatusIcon status={status} className="size-4" />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
        {highlight && (
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Highlighting {DAY_STATUS_META[highlight].label} days.{' '}
            <button
              type="button"
              onClick={() => {
                setHighlight(null)
              }}
              className="font-medium text-sidebar underline-offset-2 hover:underline dark:text-primary"
            >
              Show all
            </button>
          </p>
        )}
      </div>

      {overview.isError ? (
        <ErrorState
          title="Could not load the attendance insights"
          message="Check your connection and try again."
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <div className="scrollbar-thin min-w-0 overflow-x-auto overscroll-x-contain">
          <table
            aria-busy={overview.isPending || overview.isFetching}
            className={cn(
              'w-max min-w-full border-separate border-spacing-0 transition-opacity',
              overview.isFetching && !overview.isPending && 'opacity-70',
            )}
          >
            <caption className="sr-only">Attendance by day, {monthLabel}</caption>
            <thead>
              <tr>
                <th scope="col" className={cn(headCell, stickyFirst, 'rounded-l-md')}>
                  Employees
                </th>
                {TOTALS.map((total) => (
                  <th key={total.key} scope="col" className={cn(headCell, 'text-center')}>
                    {total.label}
                  </th>
                ))}
                {days.map((day, index) => {
                  const date = parse(day, 'yyyy-MM-dd', new Date())
                  return (
                    <th
                      key={day}
                      scope="col"
                      aria-current={day === today ? 'date' : undefined}
                      className={cn(
                        headCell,
                        'w-11 min-w-11 px-1 text-center leading-tight',
                        day === today && 'bg-sidebar/15',
                        index === days.length - 1 && 'rounded-r-md',
                      )}
                    >
                      <span className="block">{format(date, 'd')}</span>
                      <span className="block text-[0.5625rem] font-normal text-grey">
                        {format(date, 'EEE')}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {overview.isPending
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={columnCount} className="border-b px-3 py-2">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.employeeId}>
                      <th
                        scope="row"
                        className={cn(bodyCell, stickyFirst, 'bg-card text-left font-normal')}
                      >
                        <span className="flex items-center gap-2.5">
                          <EmployeeAvatar name={row.employeeName} className="size-7" />
                          <span className="min-w-0">
                            <span className={personNameClass}>{row.employeeName}</span>
                            <span className={cn(personCodeClass, 'truncate')}>
                              {[row.employeeCode, row.departmentName].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </span>
                      </th>
                      {TOTALS.map((total) => (
                        <td key={total.key} className={cn(bodyCell, 'text-center tabular-nums')}>
                          {row.totals[total.key]}
                        </td>
                      ))}
                      {days.map((day) => {
                        const status: DayStatus | null = row.days[day] ?? null
                        const label = status ? DAY_STATUS_META[status].label : 'Not processed'
                        return (
                          <td
                            key={day}
                            className={cn(
                              bodyCell,
                              'px-0.5 text-center',
                              day === today && 'bg-sidebar/5',
                            )}
                          >
                            {status ? (
                              <button
                                type="button"
                                title={label}
                                aria-label={`${row.employeeName}, ${format(parse(day, 'yyyy-MM-dd', new Date()), 'd MMMM')}: ${label}`}
                                onClick={() => {
                                  setOpenDay({ employeeId: row.employeeId, date: day })
                                }}
                                className={cn(
                                  'mx-auto flex size-8 items-center justify-center rounded-md transition-opacity outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60',
                                  highlight !== null && status !== highlight && 'opacity-20',
                                  highlight === status && 'bg-sidebar/10',
                                )}
                              >
                                <StatusIcon status={status} />
                              </button>
                            ) : (
                              <span aria-label={label} className="text-label">
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              {!overview.isPending && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No employees match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
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

      {openDay && (
        <TimeSheetViewDialog
          dayKey={openDay}
          onClose={() => {
            setOpenDay(null)
          }}
        />
      )}
    </section>
  )
}
