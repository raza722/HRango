import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { differenceInCalendarDays, format, subDays } from 'date-fns'
import { Search } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, Pagination, ScopeTabs } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PunchRequestDialog,
  type PunchRequestStart,
  type PunchRequestType,
  typePermission,
} from '@/features/requests'
import { useSearchAsYouType } from '@/hooks/use-search-as-you-type'
import { ApiError } from '@/lib/api-error'
import { parseDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { PUNCH_STATUS_META } from '../../constants'
import { useTimeSheet } from '../../hooks/use-attendance'
import type { MissingPunchSearch } from '../../routing'
import {
  type DayKey,
  TIME_SHEET_SCOPES,
  type TimeSheetDay,
  type TimeSheetParams,
  type TimeSheetScope,
} from '../../types/attendance.types'
import {
  formatClockTime,
  formatExpected,
  formatSheetDate,
  weekdayName,
} from '../../utils/local-time'
import { rowActions } from '../../utils/row-actions'
import { TimeSheetEditDialog } from '../dialogs/time-sheet-edit-dialog'
import { TimeSheetViewDialog } from '../dialogs/time-sheet-view-dialog'
import { AttendanceSubLayout } from '../layout/attendance-sub-layout'
import { DateBox } from '../shared/date-box'
import { EmployeeFilter } from '../shared/employee-filter'

const routeApi = getRouteApi('/_app/attendance/missing-punch')

/** The days shown when the URL names none: the last 30, up to today. */
const DEFAULT_DAYS = 30
/** Longest From → To range at once (the API allows a year). */
const MAX_DAYS = 366

const VIEW_CODE = 'attendance.time_sheet.view'

type Dialog =
  | { type: 'request'; start: PunchRequestStart; forOthers: boolean }
  | { type: 'view' | 'edit'; day: TimeSheetDay }
  | null

const keyOf = (day: TimeSheetDay): DayKey => ({ employeeId: day.employeeId, date: day.workDate })

/** Which punches the day lacks: a check in, a check out, or (rarely) both. */
function missingOf(day: TimeSheetDay) {
  const checkIn = !day.firstIn || day.clockInStatus === 'missing'
  const checkOut = !day.lastOut || day.clockOutStatus === 'missing'
  return { checkIn, checkOut }
}

/** The punch a request should add: the check out when the check in is there. */
const punchToRequest = (day: TimeSheetDay): PunchRequestType =>
  missingOf(day).checkIn ? 'check_in' : 'check_out'

function rangeError(from: string, to: string): string | null {
  const start = parseDateValue(from)
  const end = parseDateValue(to)
  if (!start || !end) return 'Choose both dates'
  if (end < start) return 'To must be on or after From'
  if (differenceInCalendarDays(end, start) + 1 > MAX_DAYS) return `Choose at most ${MAX_DAYS} days`
  return null
}

function MissingChip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs leading-none font-medium whitespace-nowrap',
        PUNCH_STATUS_META.missing.className,
      )}
    >
      {label}
    </span>
  )
}

/** A punch time, or "Missing" when the day lacks it; the expected time beneath. */
function PunchCell({
  time,
  missing,
  expected,
}: {
  time: string | null
  missing: boolean
  expected: string | null
}) {
  return (
    <span className="grid justify-items-start gap-1">
      {missing || !time ? (
        <MissingChip label="Missing" />
      ) : (
        <span className="text-title">{formatClockTime(time)}</span>
      )}
      {expected && <span className="text-xs text-grey">{formatExpected(expected)}</span>}
    </span>
  )
}

/**
 * Attendance → Missing Punch: the time sheet's days with a check in but no check out (or the
 * other way round), `GET /attendance/time-sheet?flag=missing_punch`, for My, Subordinates or All.
 * Each day offers Request Punch (Requests → Punch, filled in with the day and the missing punch),
 * View, and Edit where the time sheet allows it. The days leave the list once the punch is
 * approved and the day worked out again.
 */
export function MissingPunchPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const defaultFrom = format(
    subDays(parseDateValue(today) ?? new Date(), DEFAULT_DAYS - 1),
    'yyyy-MM-dd',
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const me = useAuthStore((state) => state.user?.employeeId ?? null)

  const canSeeTeam = useCan(`${VIEW_CODE}@team`)
  const canSeeAll = useCan(`${VIEW_CODE}@all`)
  const canEdit = useCan('attendance.time_sheet.edit')
  const punchCode = typePermission('punch', 'create')
  const canRequestOwn = useCan(punchCode)
  const canRequestOthers = useCan(`${punchCode}@team`)
  const scopes = TIME_SHEET_SCOPES.filter(
    (scope) => scope === 'my' || (scope === 'subordinates' ? canSeeTeam : canSeeAll),
  )
  const scope: TimeSheetScope = scopes.includes(search.scope) ? search.scope : 'my'
  const isMy = scope === 'my'

  const from = search.from ?? defaultFrom
  const to = search.to ?? today
  const error = rangeError(from, to)
  const employeeId = isMy ? undefined : search.employeeId

  const update = (patch: Partial<MissingPunchSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  // The name searched as you type (a pause after the last key).
  const textSearch = useSearchAsYouType({
    value: search.q,
    onSearch: (q) => {
      update({ q, page: 1 })
    },
  })

  const params: TimeSheetParams = {
    scope,
    flag: 'missing_punch',
    from,
    to,
    page: search.page,
    pageSize: search.pageSize,
    ...(employeeId ? { employeeId } : {}),
    ...(!isMy && search.q ? { search: search.q } : {}),
  }
  const sheet = useTimeSheet(params, error === null)
  const rows = sheet.data?.data ?? []
  const meta = sheet.data?.meta
  const personName = employeeId
    ? rows.find((row) => row.employeeId === employeeId)?.employeeName
    : undefined

  const mayRequest = (day: TimeSheetDay) =>
    day.employeeId === me ? canRequestOwn : canRequestOthers
  const requestPunch = (day: TimeSheetDay) => {
    const own = day.employeeId === me
    setDialog({
      type: 'request',
      forOthers: !own,
      start: {
        date: day.workDate,
        punchType: punchToRequest(day),
        ...(own
          ? {}
          : { employee: { id: day.employeeId, name: day.employeeName, code: day.employeeCode } }),
      },
    })
  }
  const close = () => {
    setDialog(null)
  }

  const columns: DataTableColumn<TimeSheetDay>[] = [
    {
      id: 'date',
      header: 'Date',
      mobile: 'heading',
      cell: (day) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-title">{formatSheetDate(day.workDate)}</span>
          <span className="text-xs text-grey">{weekdayName(day.workDate)}</span>
        </span>
      ),
    },
    ...(isMy
      ? []
      : [
          {
            id: 'employee',
            header: 'Employee',
            cell: (day: TimeSheetDay) => (
              <span className="grid gap-0.5">
                <span className="font-medium text-title">{day.employeeName}</span>
                <span className="text-xs text-grey">
                  {[day.employeeCode, day.departmentName].filter(Boolean).join(' · ')}
                </span>
              </span>
            ),
          },
        ]),
    {
      id: 'slot',
      header: 'Time Slot',
      cell: (day) => day.timeSlotName ?? '—',
    },
    {
      id: 'in',
      header: 'Check In',
      cell: (day) => (
        <PunchCell time={day.firstIn} missing={missingOf(day).checkIn} expected={day.expectedIn} />
      ),
    },
    {
      id: 'out',
      header: 'Check Out',
      cell: (day) => (
        <PunchCell
          time={day.lastOut}
          missing={missingOf(day).checkOut}
          expected={day.expectedOut}
        />
      ),
    },
    {
      id: 'missing',
      header: 'Missing',
      cell: (day) => {
        const missing = missingOf(day)
        return (
          <span className="flex flex-wrap gap-1.5">
            {missing.checkIn && <MissingChip label="Check In" />}
            {missing.checkOut && <MissingChip label="Check Out" />}
            {!missing.checkIn && !missing.checkOut && <MissingChip label="A punch" />}
          </span>
        )
      },
    },
  ]

  const dayLabel = (day: TimeSheetDay) =>
    isMy ? formatSheetDate(day.workDate) : `${day.employeeName}, ${formatSheetDate(day.workDate)}`

  return (
    <AttendanceSubLayout current="missing-punch">
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <header className="grid gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h1 className="text-xl font-medium text-title sm:text-2xl">Missing Punch</h1>
              <p className="max-w-2xl text-sm text-grey">
                Days with a check in but no check out, or the other way round. Ask for the missing
                punch with Request Punch: once it is approved, the day is worked out again and
                leaves this list.
              </p>
            </div>
            {meta && error === null && (
              <p
                aria-live="polite"
                className="rounded-full bg-[#F17D5B]/15 px-3 py-1 text-sm font-medium text-[#C2502F] dark:text-[#F7A68C]"
              >
                {meta.total.toLocaleString()} {meta.total === 1 ? 'day' : 'days'}
              </p>
            )}
          </div>
          {scopes.length > 1 && (
            <ScopeTabs
              label="Whose missing punches"
              scopes={scopes}
              value={scope}
              onChange={(next) => {
                update({ scope: next, page: 1, q: undefined, employeeId: undefined })
              }}
            />
          )}
        </header>

        <section
          aria-label={personName ? `Missing punches of ${personName}` : 'Missing punches'}
          className="@container grid grid-cols-1 gap-4 rounded-xl bg-card py-4 shadow-xs"
        >
          <div className="grid grid-cols-1 items-start gap-x-5 gap-y-3 px-4 sm:px-5 @md:grid-cols-2 @4xl:grid-cols-4">
            {!isMy && (
              <EmployeeFilter
                label="Employee"
                filters={{ permission: VIEW_CODE, includeInactive: true }}
                known={
                  employeeId && personName ? [{ value: employeeId, label: personName }] : undefined
                }
                value={employeeId}
                onChange={(next) => {
                  update({ employeeId: next, page: 1 })
                }}
              />
            )}
            <DateBox
              label="From"
              value={from}
              maxDate={parseDateValue(today)}
              onChange={(next) => {
                update({ from: next === defaultFrom ? undefined : next, page: 1 })
              }}
            />
            <div className="grid gap-1">
              <DateBox
                label="To"
                value={to}
                minDate={parseDateValue(from)}
                onChange={(next) => {
                  update({ to: next === today ? undefined : next, page: 1 })
                }}
              />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            {!isMy && (
              <div className="grid gap-1.5">
                <span aria-hidden="true" className="hidden text-sm font-medium @md:block">
                  &nbsp;
                </span>
                <div role="search" className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
                  />
                  <Input
                    type="search"
                    aria-label="Search missing punches"
                    placeholder="Search name or code"
                    {...textSearch.inputProps}
                    className="h-10 pl-9 placeholder:text-grey sm:pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          {sheet.isError ? (
            <ErrorState
              title="Could not load the missing punches"
              message={
                sheet.error instanceof ApiError && sheet.error.isClientError
                  ? sheet.error.message
                  : 'Check your connection and try again.'
              }
              onRetry={() => void sheet.refetch()}
            />
          ) : (
            <div className="px-4 sm:px-5">
              <DataTable
                columns={columns}
                data={error === null ? rows : []}
                getRowId={(day) => day.id}
                caption="Missing punches"
                isLoading={error === null && sheet.isPending}
                isFetching={sheet.isFetching}
                appearance="brand"
                emptyState={
                  error
                    ? 'Choose a valid From and To.'
                    : `No missing punches from ${formatSheetDate(from)} to ${formatSheetDate(to)}.`
                }
                rowActionsHeader="Actions"
                rowActions={(day) => (
                  // Phones (cards): one under another, so the date keeps its room.
                  <div className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
                    {mayRequest(day) && (
                      <Button
                        size="sm"
                        aria-label={`Request punch, ${dayLabel(day)}`}
                        onClick={() => {
                          requestPunch(day)
                        }}
                        className="bg-[#EE5F35] text-white hover:bg-[#EE5F35]/90"
                      >
                        Request Punch
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`View, ${dayLabel(day)}`}
                      onClick={() => {
                        setDialog({ type: 'view', day })
                      }}
                    >
                      View
                    </Button>
                    {rowActions(day, scope, today, canEdit).includes('edit') && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Edit, ${dayLabel(day)}`}
                        onClick={() => {
                          setDialog({ type: 'edit', day })
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          )}

          {meta && meta.total > 0 && error === null && (
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
                  update({ page })
                }}
              />
            </div>
          )}
        </section>
      </div>

      {dialog?.type === 'request' && (
        <PunchRequestDialog forOthers={dialog.forOthers} initial={dialog.start} onClose={close} />
      )}
      {dialog?.type === 'view' && (
        <TimeSheetViewDialog
          dayKey={keyOf(dialog.day)}
          onClose={close}
          onEdit={
            rowActions(dialog.day, scope, today, canEdit).includes('edit')
              ? () => {
                  setDialog({ type: 'edit', day: dialog.day })
                }
              : undefined
          }
        />
      )}
      {dialog?.type === 'edit' && (
        <TimeSheetEditDialog dayKey={keyOf(dialog.day)} onClose={close} />
      )}
    </AttendanceSubLayout>
  )
}
