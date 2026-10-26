import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { endOfMonth, format } from 'date-fns'
import { Download, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'
import { ScopeTabs } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'

import { attendanceApi } from '../../api/attendance.api'
import { DAY_FLAG_LABELS, TIME_SHEET_PAGE_SIZES } from '../../constants'
import { useDaysOverview, useProcessTimeSheet, useTimeSheet } from '../../hooks/use-attendance'
import type { TimeSheetSearch } from '../../routing'
import {
  type DayKey,
  TIME_SHEET_SCOPES,
  type TimeSheetAction,
  type TimeSheetDay,
  type TimeSheetParams,
} from '../../types/attendance.types'
import { rowActions } from '../../utils/row-actions'
import { TimeSheetEditDialog } from '../dialogs/time-sheet-edit-dialog'
import { TimeSheetViewDialog } from '../dialogs/time-sheet-view-dialog'
import { ClockCard } from './clock-card'
import { DaysOverviewCard } from './days-overview-card'
import { TimeSheetFilters } from './time-sheet-filters'
import { TimeSheetTable } from './time-sheet-table'

const routeApi = getRouteApi('/_app/attendance/time-sheet')

type DialogState = { action: TimeSheetAction; day: TimeSheetDay } | null

const keyOf = (day: TimeSheetDay): DayKey => ({ employeeId: day.employeeId, date: day.workDate })

const TITLES = {
  my: 'My Time Sheet',
  subordinates: 'Subordinates Time Sheet',
  all: 'All Time Sheet',
}

/**
 * My / Subordinates / All Time Sheet: the clock, this month's counts, then the
 * days between From and To. My shows the signed-in person; Subordinates and All
 * everyone the user reaches (or the person picked in Employee Name), with Edit
 * beside View. Export and Process follow the user's permissions.
 */
export function TimeSheetPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [dialog, setDialog] = useState<DialogState>(null)
  const canClock = useCan('attendance.time_sheet.clock')
  const canEdit = useCan('attendance.time_sheet.edit')
  const canExport = useCan('attendance.time_sheet.export')
  const canProcess = useCan('attendance.time_sheet.process')
  const process = useProcessTimeSheet()

  const from = search.from ?? `${today.slice(0, 7)}-01`
  const to = search.to ?? today
  const isMy = search.scope === 'my'
  const employeeId = isMy ? undefined : search.employeeId

  const params: TimeSheetParams = {
    scope: search.scope,
    ...(employeeId ? { employeeId } : {}),
    from,
    to,
    page: search.page,
    pageSize: search.pageSize,
    ...(search.q ? { search: search.q } : {}),
    ...(!isMy && search.status !== 'all' ? { status: search.status } : {}),
    ...(search.dayStatus ? { dayStatus: search.dayStatus } : {}),
    ...(search.flag ? { flag: search.flag } : {}),
  }
  const sheet = useTimeSheet(params)
  const overview = useDaysOverview({
    scope: search.scope,
    from: `${today.slice(0, 7)}-01`,
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    ...(employeeId ? { employeeId } : {}),
  })

  const update = (patch: Partial<TimeSheetSearch>, replace = false) =>
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

  const meta = sheet.data?.meta
  const rows = sheet.data?.data ?? []
  const personName = employeeId ? rows[0]?.employeeName : undefined
  const filterKey = [search.scope, search.status, employeeId, from, to].join('|')
  const close = () => {
    setDialog(null)
  }

  const exportSheet = async () => {
    try {
      await attendanceApi.exportTimeSheet(params)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not export the time sheet.')
    }
  }

  return (
    <PageContainer>
      <h1 className="sr-only">{TITLES[search.scope]}</h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {canClock && <ClockCard />}
        <DaysOverviewCard
          overview={overview.data}
          personName={isMy ? undefined : (personName ?? 'Everyone in this view')}
        />
      </div>

      <div className="rounded-xl bg-card px-4 py-3.5 shadow-xs sm:px-5">
        <ScopeTabs
          label="Whose time sheet"
          scopes={TIME_SHEET_SCOPES}
          value={search.scope}
          onChange={(scope) => {
            void update({ scope, page: 1, q: undefined, employeeId: undefined })
          }}
        />
      </div>

      <TimeSheetFilters
        key={filterKey}
        scope={search.scope}
        initial={{ status: search.status, employeeId, from, to }}
        knownEmployee={
          employeeId && rows[0]
            ? { value: employeeId, label: rows[0].employeeName, hint: rows[0].employeeCode }
            : undefined
        }
        onApply={(values) => {
          void update({
            status: values.status,
            employeeId: isMy ? undefined : values.employeeId,
            from: values.from === `${today.slice(0, 7)}-01` ? undefined : values.from,
            to: values.to === today ? undefined : values.to,
            page: 1,
          })
        }}
      />

      <section
        aria-label={personName ? `Time sheet of ${personName}` : 'Time sheet'}
        className="grid gap-4 overflow-hidden rounded-xl bg-card py-4 font-inter shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5">
          <label className="flex items-center gap-2 text-sm text-field-foreground">
            Show
            <Select
              value={String(search.pageSize)}
              onValueChange={(value) => {
                void update({ pageSize: Number(value), page: 1 })
              }}
            >
              <SelectTrigger aria-label="Entries per page" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SHEET_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            entries
          </label>
          {search.flag && (
            <button
              type="button"
              onClick={() => {
                void update({ flag: undefined, page: 1 })
              }}
              className="rounded-full bg-muted px-3 py-1 text-xs text-title hover:bg-muted/70"
            >
              Only {DAY_FLAG_LABELS[search.flag]} days ✕
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {canProcess && !isMy && (
              <Button
                variant="outline"
                size="sm"
                disabled={process.isPending}
                onClick={() => {
                  process.mutate({
                    fromDate: from,
                    toDate: to,
                    ...(employeeId ? { employeeIds: [employeeId] } : {}),
                  })
                }}
                title="Work the time sheet out again from the punches, schedules and requests"
              >
                <RefreshCw /> Process
              </Button>
            )}
            {canExport && (
              <Button variant="outline" size="sm" onClick={() => void exportSheet()}>
                <Download /> Export
              </Button>
            )}
            <div className="relative w-full sm:w-56">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                type="search"
                aria-label="Search days"
                placeholder="Search"
                value={text}
                onChange={(event) => {
                  const value = event.target.value
                  setText(value)
                  window.clearTimeout(searchTimer.current)
                  searchTimer.current = window.setTimeout(() => {
                    void update({ q: value.trim() || undefined, page: 1 }, true)
                  }, 300)
                }}
                className="h-8 pl-9 placeholder:text-grey sm:pl-9 sm:text-base"
              />
            </div>
          </div>
        </div>

        {sheet.isError ? (
          <ErrorState
            title="Could not load the time sheet"
            message={
              sheet.error instanceof ApiError && sheet.error.isClientError
                ? sheet.error.message
                : 'Check your connection and try again.'
            }
            onRetry={() => void sheet.refetch()}
          />
        ) : (
          <TimeSheetTable
            rows={rows}
            scope={search.scope}
            today={today}
            isLoading={sheet.isPending}
            isFetching={sheet.isFetching}
            canEdit={canEdit}
            onAction={(action, day) => {
              setDialog({ action, day })
            }}
          />
        )}

        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-5">
            <p className="text-sm text-muted-foreground">
              Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} days
            </p>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              disabled={sheet.isFetching}
              onPageChange={(page) => {
                void update({ page })
              }}
            />
          </div>
        )}
      </section>

      {dialog?.action === 'edit' && (
        <TimeSheetEditDialog dayKey={keyOf(dialog.day)} onClose={close} />
      )}
      {dialog?.action === 'view' && (
        <TimeSheetViewDialog
          dayKey={keyOf(dialog.day)}
          onClose={close}
          onEdit={
            rowActions(dialog.day, search.scope, today, canEdit).includes('edit')
              ? () => {
                  setDialog({ action: 'edit', day: dialog.day })
                }
              : undefined
          }
        />
      )}
    </PageContainer>
  )
}
