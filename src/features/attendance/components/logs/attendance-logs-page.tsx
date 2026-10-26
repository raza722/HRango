import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format, parse } from 'date-fns'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DownloadCircleIcon } from '@/components/icons/attendance-menu-icons'
import {
  DataTable,
  type DataTableColumn,
  EmployeeAvatar,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { parseDateValue, toDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../constants'
import { useAttendanceLogs, useDeleteLog, useIgnoreLog } from '../../hooks/use-attendance-logs'
import type { LogsSearch } from '../../routing'
import { PUNCH_SOURCES, PUNCH_TYPES } from '../../types/attendance.types'
import type { AttendanceLogRow } from '../../types/logs.types'
import { punchDescription } from '../../utils/day'
import { parseLocal } from '../../utils/local-time'
import {
  compactTableClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  personCodeClass,
  personNameClass,
  toolbarButtonClass,
} from '../../utils/settings-styles'
import { AttendanceSubLayout } from '../layout/attendance-sub-layout'
import { DateBox } from '../shared/date-box'
import { EmployeeFilter } from '../shared/employee-filter'
import { FilterSelect } from '../shared/filter-select'
import { DownloadLogDialog, ImportLogDialog, LogFormDialog, LogViewDialog } from './log-dialogs'

const routeApi = getRouteApi('/_app/attendance/logs')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'create' | 'import' | 'download' }
  | { type: 'view' | 'edit' | 'delete'; log: AttendanceLogRow }
  | null

const columns: DataTableColumn<AttendanceLogRow>[] = [
  {
    id: 'employee',
    header: 'Employees',
    mobile: 'heading',
    cell: (row) => (
      <span className="flex items-center gap-2.5">
        <EmployeeAvatar name={row.employeeName} className="size-7" />
        <span className="min-w-0">
          <span className={personNameClass}>{row.employeeName}</span>
          <span className={personCodeClass}>{row.employeeCode}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'type',
    header: 'Punch Type',
    cell: (row) => (
      <span className="leading-tight">
        <span className={row.isIgnored ? 'line-through' : undefined}>
          {PUNCH_TYPE_LABELS[row.punchType]}
        </span>
        {row.isIgnored && <span className="block text-xs text-muted-foreground">Ignored</span>}
      </span>
    ),
  },
  {
    id: 'time',
    header: 'Punch Time',
    cell: (row) => (
      <span className="leading-tight">
        {format(parseLocal(row.punchedAt), 'hh:mm a')}
        <span className="block">{format(parseLocal(row.punchedAt), 'MMMM d, yyyy')}</span>
      </span>
    ),
  },
  { id: 'source', header: 'Source', cell: (row) => PUNCH_SOURCE_LABELS[row.source] },
  {
    id: 'machine',
    header: 'Machine',
    cell: (row) =>
      row.deviceId ? (
        <span className="leading-tight">
          {row.deviceName ?? 'Machine'}
          {row.deviceCode && <span className="block">({row.deviceCode})</span>}
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-2 max-w-48 whitespace-normal">{punchDescription(row)}</span>
    ),
  },
]

/**
 * Attendance Logs: every punch (machine, manual, dashboard, mobile, punch
 * request, imported file) with Download, Import (a file) and + Create. Manual
 * and imported punches can be edited or deleted; the others can be ignored
 * (and counted again). Buttons follow the user's permissions.
 */
export function AttendanceLogsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => toDateValue(new Date()))
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteLog()
  const ignore = useIgnoreLog()
  const can = {
    create: useCan('attendance.logs.create'),
    edit: useCan('attendance.logs.edit'),
    delete: useCan('attendance.logs.delete'),
    import: useCan('attendance.logs.import'),
    export: useCan('attendance.logs.export'),
  }
  const from = search.from ?? today
  const to = search.to ?? from
  const logs = useAttendanceLogs({
    from,
    to,
    page: search.page,
    pageSize: PAGE_SIZE,
    ...(search.employeeId ? { employeeId: search.employeeId } : {}),
    ...(search.type ? { punchType: search.type } : {}),
    ...(search.source ? { source: search.source } : {}),
    ...(search.q ? { q: search.q } : {}),
  })
  const update = (patch: Partial<LogsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) })
  const meta = logs.data?.meta
  // The filtered person's name, from their own punches, until the picker has read them.
  const filteredRow = search.employeeId
    ? logs.data?.data.find((row) => row.employeeId === search.employeeId)
    : undefined
  const employeeKnown = filteredRow
    ? [
        {
          value: filteredRow.employeeId,
          label: filteredRow.employeeName,
          hint: filteredRow.employeeCode,
        },
      ]
    : undefined
  const range =
    from === to
      ? format(parse(from, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy')
      : `${format(parse(from, 'yyyy-MM-dd', new Date()), 'd MMM')} – ${format(parse(to, 'yyyy-MM-dd', new Date()), 'd MMM yyyy')}`

  return (
    <AttendanceSubLayout current="logs">
      <section
        aria-labelledby="attendance-logs-title"
        className="grid gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="attendance-logs-title" className={pageTitleClass}>
            Attendance Logs
          </h1>
          <div className="flex flex-wrap gap-2.5">
            {can.export && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialog({ type: 'download' })
                }}
                className={outlineButtonClass}
              >
                <DownloadCircleIcon className="size-5" /> Download
              </Button>
            )}
            {can.import && (
              <Button
                onClick={() => {
                  setDialog({ type: 'import' })
                }}
                className={cn(toolbarButtonClass, 'bg-[#4CBB6C] text-white hover:bg-[#4CBB6C]/90')}
              >
                <DownloadCircleIcon className="size-5 rotate-180" /> Import
              </Button>
            )}
            {can.create && (
              <Button
                onClick={() => {
                  setDialog({ type: 'create' })
                }}
                className={cn(toolbarButtonClass, navyButtonClass)}
              >
                + Create
              </Button>
            )}
          </div>
        </div>

        <div className="@container grid gap-3 rounded-md bg-muted/50 p-3">
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-5">
            <DateBox
              label="From"
              value={from}
              maxDate={new Date()}
              onChange={(value) => {
                void update({
                  from: value === today ? undefined : value,
                  to: to < value ? value : search.to,
                })
              }}
            />
            <DateBox
              label="To"
              value={to}
              minDate={parseDateValue(from)}
              maxDate={new Date()}
              onChange={(value) => {
                void update({ to: value === from ? undefined : value })
              }}
            />
            <EmployeeFilter
              label="Employee"
              // Former staff too: their punches stay in the logs.
              filters={{ permission: 'attendance.logs.view', includeInactive: true }}
              known={employeeKnown}
              value={search.employeeId}
              onChange={(employeeId) => {
                void update({ employeeId })
              }}
            />
            <FilterSelect
              label="Punch Type"
              showLabel
              allLabel="All punch types"
              options={PUNCH_TYPES.map((type) => ({ value: type, label: PUNCH_TYPE_LABELS[type] }))}
              value={search.type}
              onChange={(type) => {
                void update({ type: PUNCH_TYPES.find((item) => item === type) })
              }}
            />
            <FilterSelect
              label="Source"
              showLabel
              allLabel="All sources"
              options={PUNCH_SOURCES.map((source) => ({
                value: source,
                label: PUNCH_SOURCE_LABELS[source],
              }))}
              value={search.source}
              onChange={(source) => {
                void update({ source: PUNCH_SOURCES.find((item) => item === source) })
              }}
            />
          </div>
        </div>

        {logs.isError ? (
          <ErrorState
            title="Could not load the attendance logs"
            message={
              logs.error instanceof ApiError && logs.error.isClientError
                ? logs.error.message
                : 'Choose at most 31 days, or check your connection and try again.'
            }
            onRetry={() => void logs.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={logs.data?.data ?? []}
            getRowId={(row) => row.id}
            caption={`Attendance logs, ${range}`}
            isLoading={logs.isPending}
            isFetching={logs.isFetching}
            className={compactTableClass}
            emptyState={
              <p className="py-10 text-center text-sm text-muted-foreground">
                No punches for {range}.
              </p>
            }
            rowActions={(row) => (
              <RowActionsMenu
                label={`Actions for ${row.employeeName}, ${PUNCH_TYPE_LABELS[row.punchType]} ${format(parseLocal(row.punchedAt), 'h:mm a')}`}
                itemClassName={rowMenuItemClass.poppins}
                actions={[
                  {
                    label: 'View',
                    onSelect: () => {
                      setDialog({ type: 'view', log: row })
                    },
                  },
                  ...(row.editable && can.edit
                    ? [
                        {
                          label: 'Edit',
                          onSelect: () => {
                            setDialog({ type: 'edit', log: row })
                          },
                        },
                      ]
                    : []),
                  ...(row.editable && can.delete
                    ? [
                        {
                          label: 'Delete',
                          variant: 'destructive' as const,
                          onSelect: () => {
                            setDialog({ type: 'delete', log: row })
                          },
                        },
                      ]
                    : []),
                  ...(!row.editable && can.edit
                    ? [
                        {
                          label: row.isIgnored ? 'Count again' : 'Ignore',
                          onSelect: () => {
                            ignore.mutate(
                              { punch: row, ignored: !row.isIgnored },
                              {
                                onError: (error) => {
                                  toast.error(
                                    error instanceof ApiError
                                      ? error.message
                                      : 'Could not change the punch.',
                                  )
                                },
                              },
                            )
                          },
                        },
                      ]
                    : []),
                ]}
              />
            )}
          />
        )}

        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} punches
            </p>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              disabled={logs.isFetching}
              onPageChange={(page) => {
                void update({ page })
              }}
            />
          </div>
        )}
      </section>

      {dialog?.type === 'create' && (
        <LogFormDialog
          log={null}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <LogFormDialog
          log={dialog.log}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'view' && (
        <LogViewDialog
          log={dialog.log}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'import' && (
        <ImportLogDialog
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'download' && (
        <DownloadLogDialog
          initialFrom={from}
          initialTo={to}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Delete punch"
        description="Are you sure you want to Delete this? The time sheet recalculates without it."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(dialog.log, {
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the punch.',
                )
              },
            })
          }
        }}
      />
    </AttendanceSubLayout>
  )
}
