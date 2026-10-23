import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Search } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'
import { ScopeTabs } from '@/components/layout'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { TIME_SHEET_PAGE_SIZES } from '../../constants'
import { useAttendanceLookups, useDaysOverview, useTimeSheet } from '../../hooks/use-attendance'
import type { TimeSheetSearch } from '../../routing'
import {
  type DayKey,
  TIME_SHEET_SCOPES,
  type TimeSheetAction,
  type TimeSheetDay,
} from '../../types/attendance.types'
import { rowActions } from '../../utils/row-actions'
import { AbsenceDialog } from '../dialogs/absence-dialog'
import { MissingPunchDialog } from '../dialogs/missing-punch-dialog'
import { OvertimeDialog } from '../dialogs/overtime-dialog'
import { RelaxationDialog } from '../dialogs/relaxation-dialog'
import { TimeSheetEditDialog } from '../dialogs/time-sheet-edit-dialog'
import { TimeSheetViewDialog } from '../dialogs/time-sheet-view-dialog'
import { ClockCard } from './clock-card'
import { DaysOverviewCard } from './days-overview-card'
import { TimeSheetFilters } from './time-sheet-filters'
import { TimeSheetTable } from './time-sheet-table'

const routeApi = getRouteApi('/_app/attendance/time-sheet')

type DialogState = { action: TimeSheetAction; day: TimeSheetDay } | null

const keyOf = (day: TimeSheetDay): DayKey => ({ employeeId: day.employeeId, date: day.date })

/**
 * My Time Sheet / All Time Sheet: the clock, this month's counts, then one
 * person's days between From and To. "All" picks the person in Employee Name
 * and adds the row actions (Edit, Missing Punch, Relaxation, Absent,
 * Overtime) beside View.
 */
export function TimeSheetPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [dialog, setDialog] = useState<DialogState>(null)
  const lookups = useAttendanceLookups()

  const from = search.from ?? `${today.slice(0, 7)}-01`
  const to = search.to ?? today
  const isAll = search.scope === 'all'
  // All: the chosen person, or the first one in the list until someone is chosen.
  const fallbackId = (lookups.data?.employees ?? []).find(
    (employee) => search.status === 'all' || employee.status === search.status,
  )?.id
  const employeeId = isAll ? (search.employeeId ?? fallbackId) : undefined
  const ready = !isAll || employeeId !== undefined

  const sheet = useTimeSheet(
    {
      ...(employeeId ? { employeeId } : {}),
      from,
      to,
      page: search.page,
      pageSize: search.pageSize,
      ...(search.q ? { search: search.q } : {}),
    },
    ready,
  )
  const overview = useDaysOverview(employeeId, ready)

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
  const person = sheet.data?.employee
  const filterKey = [search.scope, search.status, employeeId, from, to].join('|')
  const close = () => {
    setDialog(null)
  }

  return (
    <PageContainer>
      <h1 className="sr-only">{isAll ? 'All Time Sheet' : 'My Time Sheet'}</h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <ClockCard />
        <DaysOverviewCard overview={overview.data} personName={isAll ? person?.name : undefined} />
      </div>

      <div className="rounded-xl bg-card px-4 py-3.5 shadow-xs sm:px-5">
        <ScopeTabs
          label="Whose time sheet"
          scopes={TIME_SHEET_SCOPES}
          value={search.scope}
          onChange={(scope) => {
            void update({ scope, page: 1, q: undefined })
          }}
        />
      </div>

      <TimeSheetFilters
        key={filterKey}
        scope={search.scope}
        initial={{ status: search.status, employeeId, from, to }}
        onApply={(values) => {
          void update({
            status: values.status,
            employeeId: isAll ? values.employeeId : undefined,
            from: values.from === `${today.slice(0, 7)}-01` ? undefined : values.from,
            to: values.to === today ? undefined : values.to,
            page: 1,
          })
        }}
      />

      <section
        aria-label={person ? `Time sheet of ${person.name}` : 'Time sheet'}
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

        {sheet.isError ? (
          <ErrorState
            title="Could not load the time sheet"
            message="Check your connection and try again."
            onRetry={() => void sheet.refetch()}
          />
        ) : (
          <TimeSheetTable
            rows={rows}
            scope={search.scope}
            today={today}
            isLoading={!ready || sheet.isPending}
            isFetching={sheet.isFetching}
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
            isAll && rowActions(dialog.day, 'all', today).includes('edit')
              ? () => {
                  setDialog({ action: 'edit', day: dialog.day })
                }
              : undefined
          }
        />
      )}
      {dialog?.action === 'missing-punch' && (
        <MissingPunchDialog day={dialog.day} onClose={close} />
      )}
      {dialog?.action === 'relaxation' && <RelaxationDialog day={dialog.day} onClose={close} />}
      {dialog?.action === 'absent' && <AbsenceDialog day={dialog.day} onClose={close} />}
      {dialog?.action === 'overtime' && <OvertimeDialog day={dialog.day} onClose={close} />}
    </PageContainer>
  )
}
