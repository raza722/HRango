import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { useCan } from '@/lib/permissions'

import { BOARD_PAGE_SIZE, SCHEDULING_PERMISSIONS } from '../constants'
import {
  useActiveShift,
  useBulkDelete,
  useDeleteRestDays,
  useDeleteSchedule,
  useExportSchedule,
  useMoveSchedule,
  useScheduleBoard,
  useScheduleYear,
  useSwapShift,
} from '../hooks/use-scheduling'
import { useSlotTones } from '../hooks/use-slot-tones'
import { FILTER_KEYS, type SchedulingSearch } from '../routing'
import type {
  BoardFilters,
  BoardParams,
  BoardRestDay,
  BoardRow,
  BoardShift,
} from '../types/scheduling.types'
import {
  eachDay,
  formatRange,
  nextDay,
  periodRange,
  shiftAnchor,
  toDay,
} from '../utils/schedule-dates'
import type { CellPermissions } from './day-cell'
import { ApplyDefaultShiftDialog } from './dialogs/apply-default-shift-dialog'
import { CreateScheduleDialog } from './dialogs/create-schedule-dialog'
import { DeleteScheduleDialog } from './dialogs/delete-schedule-dialog'
import { EditEntryDialog } from './dialogs/edit-entry-dialog'
import { MultiEditDialog } from './dialogs/multi-edit-dialog'
import { RestDayDialog } from './dialogs/rest-day-dialog'
import { SwapShiftDialog } from './dialogs/swap-shift-dialog'
import { TrashConfirmDialog } from './dialogs/trash-confirm-dialog'
import { ViewEntryDialog, ViewRestDayDialog } from './dialogs/view-entry-dialog'
import { ScheduleBoard } from './schedule-board'
import { SchedulingFilters } from './scheduling-filters'
import { SchedulingHeader } from './scheduling-header'
import { schedulingType } from './type-styles'
import { YearBoard } from './year-board'

const routeApi = getRouteApi('/_app/scheduling')

/** Longest custom Date From → Date To range shown as days (the API allows 93). */
const MAX_CUSTOM_DAYS = 93

type DialogState =
  | { type: 'create'; employeeIds?: string[]; date?: string }
  | { type: 'rest-day'; employeeIds?: string[]; date?: string }
  | { type: 'apply-default' }
  | { type: 'delete-range' }
  | { type: 'edit' | 'view' | 'delete-shift'; shift: BoardShift }
  | { type: 'swap'; shift: BoardShift; row: BoardRow }
  | { type: 'view-rest' | 'delete-rest'; restDay: BoardRestDay; row: BoardRow }
  | { type: 'multi-edit' }
  | { type: 'multi-delete' }
  | null

function boardFilters(search: SchedulingSearch): BoardFilters {
  const filters: BoardFilters = {}
  if (search.q) filters.search = search.q
  if (search.status !== 'all') filters.employeeStatus = search.status
  const keys = [
    'employeeId',
    'departmentId',
    'branchId',
    'locationId',
    'designationId',
    'employmentTypeId',
    'employeeGroupId',
    'gradeId',
    'timeSlotId',
    'rosterGroupId',
  ] as const
  for (const key of keys) {
    const value = search[key]
    if (value) filters[key] = value
  }
  return filters
}

/**
 * Scheduling: who works which shift on which day (`/api/scheduling/schedules`). My / All /
 * Subordinates tabs, a week, month or year grid, and the actions from the designs the API
 * supports: Create Scheduling, Apply Default Shift, Delete, Export, Enable / Disable
 * Multiselect (Multi Edit, Multi Delete), and per shift Edit, View, Swap (drag a shift onto
 * another cell) and Delete. Buttons the user's permissions do not allow are left out.
 */
export function SchedulingPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => toDay(new Date()))
  const [multiselect, setMultiselect] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const canCreate = useCan(SCHEDULING_PERMISSIONS.create)
  const canEdit = useCan(SCHEDULING_PERMISSIONS.edit)
  const canDelete = useCan(SCHEDULING_PERMISSIONS.delete)
  const canExport = useCan(SCHEDULING_PERMISSIONS.export)
  const canCreateRestDay = useCan(SCHEDULING_PERMISSIONS.restDaysCreate)
  const canDeleteRestDay = useCan(SCHEDULING_PERMISSIONS.restDaysDelete)
  const can = { create: canCreate, edit: canEdit, delete: canDelete, export: canExport }
  const cellCan: CellPermissions = {
    create: canCreate,
    edit: canEdit,
    delete: canDelete,
    createRestDay: canCreateRestDay,
    deleteRestDay: canDeleteRestDay,
  }

  const anchor = search.date ?? today
  const custom = search.from !== undefined && search.to !== undefined
  const period = custom
    ? { from: search.from ?? anchor, to: search.to ?? anchor }
    : periodRange(search.view, anchor)
  const isYear = search.view === 'year' && !custom
  const days = isYear ? [] : eachDay(period.from, period.to).slice(0, MAX_CUSTOM_DAYS)
  const to = isYear ? period.to : (days.at(-1) ?? period.to)
  const filters = boardFilters(search)
  const params: BoardParams = {
    scope: search.scope,
    from: period.from,
    to,
    page: search.page,
    pageSize: BOARD_PAGE_SIZE,
    ...filters,
  }
  const year = Number(period.from.slice(0, 4))

  const board = useScheduleBoard(params, !isYear)
  const yearBoard = useScheduleYear(
    { scope: search.scope, year, page: search.page, pageSize: BOARD_PAGE_SIZE, ...filters },
    isYear,
  )
  const current = isYear ? yearBoard : board
  const activeShift = useActiveShift()
  const tones = useSlotTones()
  const swap = useSwapShift()
  const move = useMoveSchedule()
  const deleteShift = useDeleteSchedule()
  const bulkDelete = useBulkDelete()
  const deleteRest = useDeleteRestDays()
  const exportCsv = useExportSchedule()

  const update = (patch: Partial<SchedulingSearch>, replace = false) =>
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

  // Bring today's column into view when a period that contains it opens.
  const hasToday = days.includes(today)
  useEffect(() => {
    if (!hasToday) return
    const cell = boardRef.current?.querySelector<HTMLElement>('th[aria-current="date"]')
    cell?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [hasToday, period.from, board.isPending])

  // Leaving multiselect (or switching tab) clears the selection.
  const [selectionContext, setSelectionContext] = useState(`${multiselect}-${search.scope}`)
  if (selectionContext !== `${multiselect}-${search.scope}`) {
    setSelectionContext(`${multiselect}-${search.scope}`)
    if (selected.size > 0) setSelected(new Set())
  }

  const rows = board.data?.data ?? []
  const meta = current.data?.meta
  const activeFilterCount = FILTER_KEYS.filter((key) => search[key] !== undefined).length

  /** A shift dropped on a cell: another date of the same person, or someone else's same date. */
  const moveShift = (shiftId: string, employeeId: string, date: string) => {
    const sourceRow = rows.find((row) => row.shifts.some((shift) => shift.id === shiftId))
    const shift = sourceRow?.shifts.find((item) => item.id === shiftId)
    if (!sourceRow || !shift) return
    if (sourceRow.employee.id === employeeId) {
      if (date !== shift.workDate) move.mutate({ id: shift.id, workDate: date })
      return
    }
    if (date !== shift.workDate) {
      toast.error('A shift goes to someone else on the same date only. Move it first, then swap.')
      return
    }
    const target = rows
      .find((row) => row.employee.id === employeeId)
      ?.shifts.find((item) => item.workDate === date)
    swap.mutate({
      id: shift.id,
      input: {
        ...(target ? { withScheduleId: target.id } : { withEmployeeId: employeeId }),
        rowVersion: shift.rowVersion,
      },
    })
  }

  const closeDialog = () => {
    setDialog(null)
  }

  return (
    <PageContainer>
      <SchedulingHeader
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
        activeShift={activeShift.data}
        multiselect={multiselect}
        onToggleMultiselect={() => {
          setMultiselect((value) => !value)
        }}
        selectedCount={selected.size}
        onMultiEdit={() => {
          setDialog({ type: 'multi-edit' })
        }}
        onMultiDelete={() => {
          setDialog({ type: 'multi-delete' })
        }}
        filtersOpen={filtersOpen}
        onToggleFilters={() => {
          setFiltersOpen((value) => !value)
        }}
        activeFilterCount={activeFilterCount}
        onRefresh={() => {
          void current.refetch()
          void activeShift.refetch()
        }}
        isRefreshing={current.isFetching && !current.isPending}
        onApplyDefault={() => {
          setDialog({ type: 'apply-default' })
        }}
        onCreate={() => {
          setDialog({ type: 'create' })
        }}
        onDelete={() => {
          setDialog({ type: 'delete-range' })
        }}
        onExport={() => {
          const { scope, from, to: last } = params
          exportCsv.mutate({ scope, from, to: last, ...filters })
        }}
        isExporting={exportCsv.isPending}
        can={can}
        filters={
          <SchedulingFilters
            search={search}
            onChange={(patch) => {
              void update({ ...patch, page: 1 }, true)
            }}
            onClear={() => {
              void update(
                {
                  ...Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])),
                  status: 'all',
                  page: 1,
                },
                true,
              )
            }}
          />
        }
      />

      <Card className="font-inter">
        <CardContent ref={boardRef} className="grid gap-4 px-3 pt-4 sm:px-4 sm:pt-5">
          {current.error && !current.data ? (
            <ErrorState
              message={current.error.message}
              onRetry={() => {
                void current.refetch()
              }}
              className="shadow-none"
            />
          ) : isYear ? (
            <YearBoard
              rows={yearBoard.data?.data ?? []}
              year={year}
              currentMonth={
                today.startsWith(period.from.slice(0, 4)) ? Number(today.slice(5, 7)) - 1 : null
              }
              rangeLabel={period.from.slice(0, 4)}
              onPrevious={() => {
                void update({ date: shiftAnchor('year', anchor, -1), page: 1 })
              }}
              onNext={() => {
                void update({ date: shiftAnchor('year', anchor, 1), page: 1 })
              }}
              isLoading={yearBoard.isPending}
              onOpenMonth={(day) => {
                void update({ view: 'month', date: day })
              }}
            />
          ) : (
            <ScheduleBoard
              rows={rows}
              days={days}
              today={today}
              rangeLabel={formatRange(period.from, to)}
              onPrevious={() => {
                void update(
                  custom
                    ? { from: nextDay(period.from, -days.length), to: nextDay(period.from, -1) }
                    : { date: shiftAnchor(search.view, anchor, -1) },
                )
              }}
              onNext={() => {
                void update(
                  custom
                    ? { from: nextDay(to, 1), to: nextDay(to, days.length) }
                    : { date: shiftAnchor(search.view, anchor, 1) },
                )
              }}
              dayTotals={board.data?.dayTotals ?? []}
              isLoading={board.isPending}
              isFetching={board.isFetching}
              multiselect={multiselect}
              selectedIds={selected}
              canCreateHere={search.scope !== 'my'}
              can={cellCan}
              toneFor={tones.toneFor}
              onToggleSelect={(shift) => {
                setSelected((picked) => {
                  const next = new Set(picked)
                  if (next.has(shift.id)) next.delete(shift.id)
                  else next.add(shift.id)
                  return next
                })
              }}
              onAction={(action, shift, row) => {
                if (action === 'swap') setDialog({ type: 'swap', shift, row })
                else setDialog({ type: action === 'delete' ? 'delete-shift' : action, shift })
              }}
              onRestDayAction={(action, restDay, row) => {
                setDialog({ type: action === 'view' ? 'view-rest' : 'delete-rest', restDay, row })
              }}
              onMove={moveShift}
              onNudge={(shift, delta) => {
                move.mutate({ id: shift.id, workDate: nextDay(shift.workDate, delta) })
              }}
              onCreateAt={(employeeId, date, kind) => {
                setDialog({
                  type: kind === 'rest' ? 'rest-day' : 'create',
                  employeeIds: [employeeId],
                  date,
                })
              }}
            />
          )}
          <div className="flex flex-col-reverse items-center justify-between gap-3 @lg:flex-row">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {meta && meta.total > 0
                ? `Showing ${(meta.page - 1) * meta.pageSize + 1} to ${Math.min(meta.page * meta.pageSize, meta.total)} of ${meta.total} employees`
                : ''}
            </p>
            <Pagination
              page={meta?.page ?? search.page}
              totalPages={meta?.totalPages ?? 1}
              onPageChange={(page) => {
                void update({ page })
              }}
              disabled={current.isPending}
              currentClassName={schedulingType.pagerCurrent}
            />
          </div>
        </CardContent>
      </Card>

      {dialog?.type === 'create' && (
        <CreateScheduleDialog
          employeeIds={dialog.employeeIds}
          date={dialog.date}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'rest-day' && (
        <RestDayDialog employeeIds={dialog.employeeIds} date={dialog.date} onClose={closeDialog} />
      )}
      {dialog?.type === 'apply-default' && <ApplyDefaultShiftDialog onClose={closeDialog} />}
      {dialog?.type === 'delete-range' && <DeleteScheduleDialog onClose={closeDialog} />}
      {dialog?.type === 'edit' && (
        <EditEntryDialog shiftId={dialog.shift.id} onClose={closeDialog} />
      )}
      {dialog?.type === 'view' && (
        <ViewEntryDialog
          shiftId={dialog.shift.id}
          onClose={closeDialog}
          onEdit={
            can.edit
              ? () => {
                  setDialog({ type: 'edit', shift: dialog.shift })
                }
              : undefined
          }
        />
      )}
      {dialog?.type === 'view-rest' && (
        <ViewRestDayDialog
          restDay={dialog.restDay}
          employeeName={dialog.row.employee.name}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'swap' && (
        <SwapShiftDialog shift={dialog.shift} row={dialog.row} rows={rows} onClose={closeDialog} />
      )}
      {dialog?.type === 'multi-edit' && (
        <MultiEditDialog
          shiftIds={[...selected]}
          onClose={closeDialog}
          onDone={() => {
            setSelected(new Set())
          }}
        />
      )}
      <TrashConfirmDialog
        open={
          dialog?.type === 'delete-shift' ||
          dialog?.type === 'multi-delete' ||
          dialog?.type === 'delete-rest'
        }
        pending={deleteShift.isPending || bulkDelete.isPending || deleteRest.isPending}
        message={
          dialog?.type === 'delete-rest'
            ? 'Are you sure you want to delete this rest day?'
            : 'Are you sure you want to Delete this Schedule? Rest Days will not be Deleted.'
        }
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'delete-shift') {
            deleteShift.mutate(
              { id: dialog.shift.id, rowVersion: dialog.shift.rowVersion },
              { onSettled: closeDialog },
            )
          } else if (dialog?.type === 'delete-rest') {
            deleteRest.mutate(
              {
                startDate: dialog.restDay.restDate,
                endDate: dialog.restDay.restDate,
                employeeIds: [dialog.row.employee.id],
                allEmployees: false,
              },
              { onSettled: closeDialog },
            )
          } else if (dialog?.type === 'multi-delete') {
            bulkDelete.mutate(
              { ids: [...selected] },
              {
                onSuccess: () => {
                  setSelected(new Set())
                },
                onSettled: closeDialog,
              },
            )
          }
        }}
      />
    </PageContainer>
  )
}
