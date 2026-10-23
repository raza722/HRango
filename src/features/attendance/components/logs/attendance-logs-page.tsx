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
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../constants'
import { useAttendanceLookups } from '../../hooks/use-attendance'
import { useAttendanceLogs, useDeleteLog } from '../../hooks/use-attendance-settings'
import type { LogsSearch } from '../../routing'
import { PUNCH_SOURCES, PUNCH_TYPES } from '../../types/attendance.types'
import type { AttendanceLogRow } from '../../types/settings.types'
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
        <EmployeeAvatar name={row.employee.name} className="size-7" />
        <span className="min-w-0">
          <span className={personNameClass}>{row.employee.name}</span>
          <span className={personCodeClass}>{row.employee.code}</span>
        </span>
      </span>
    ),
  },
  { id: 'type', header: 'Punch Type', cell: (row) => PUNCH_TYPE_LABELS[row.type] },
  {
    id: 'time',
    header: 'Punch Time',
    cell: (row) => (
      <span className="leading-tight">
        {format(parseLocal(row.at), 'hh:mm a')}
        <span className="block">{format(parseLocal(row.at), 'MMMM d, yyyy')}</span>
      </span>
    ),
  },
  { id: 'source', header: 'Source', cell: (row) => PUNCH_SOURCE_LABELS[row.source] },
  {
    id: 'machine',
    header: 'Machine',
    cell: (row) =>
      row.machineId ? (
        <span className="leading-tight">
          Machine
          <span className="block">({row.machineId})</span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-2 max-w-48 whitespace-normal">{row.description || '—'}</span>
    ),
  },
]

/**
 * Attendance Logs: every punch (machine, manual, dashboard, punch request,
 * imported file) with Download, Import (Computer or Machine) and + Create.
 * Manual and imported punches can be edited or deleted.
 */
export function AttendanceLogsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => toDateValue(new Date()))
  const [dialog, setDialog] = useState<Dialog>(null)
  const lookups = useAttendanceLookups()
  const remove = useDeleteLog()
  const from = search.from ?? today
  const to = search.to ?? from
  const logs = useAttendanceLogs({
    from,
    to,
    page: search.page,
    pageSize: PAGE_SIZE,
    ...(search.employeeId ? { employeeId: search.employeeId } : {}),
    ...(search.type ? { type: search.type } : {}),
    ...(search.source ? { source: search.source } : {}),
  })
  const update = (patch: Partial<LogsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) })
  const meta = logs.data?.meta
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
            <Button
              variant="outline"
              onClick={() => {
                setDialog({ type: 'download' })
              }}
              className={outlineButtonClass}
            >
              <DownloadCircleIcon className="size-5" /> Download
            </Button>
            <Button
              onClick={() => {
                setDialog({ type: 'import' })
              }}
              className={cn(toolbarButtonClass, 'bg-[#4CBB6C] text-white hover:bg-[#4CBB6C]/90')}
            >
              <DownloadCircleIcon className="size-5 rotate-180" /> Import
            </Button>
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButtonClass, navyButtonClass)}
            >
              + Create
            </Button>
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
            <FilterSelect
              label="Employee"
              showLabel
              allLabel="All employees"
              options={(lookups.data?.employees ?? []).map((employee) => ({
                value: employee.id,
                label: `${employee.code} | ${employee.name}`,
              }))}
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
            message="Choose at most 31 days, or check your connection and try again."
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
                label={`Actions for ${row.employee.name}, ${PUNCH_TYPE_LABELS[row.type]} ${format(parseLocal(row.at), 'h:mm a')}`}
                itemClassName={rowMenuItemClass.poppins}
                actions={[
                  {
                    label: 'View',
                    onSelect: () => {
                      setDialog({ type: 'view', log: row })
                    },
                  },
                  ...(row.editable
                    ? [
                        {
                          label: 'Edit',
                          onSelect: () => {
                            setDialog({ type: 'edit', log: row })
                          },
                        },
                        {
                          label: 'Delete',
                          variant: 'destructive' as const,
                          onSelect: () => {
                            setDialog({ type: 'delete', log: row })
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
            remove.mutate(dialog.log.id, {
              onError: () => {
                toast.error('Could not delete the punch.')
              },
            })
          }
        }}
      />
    </AttendanceSubLayout>
  )
}
