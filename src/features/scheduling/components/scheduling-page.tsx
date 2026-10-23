import { useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, Pagination } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'

import { schedulingApi } from '../api/scheduling.api'
import { BOARD_PAGE_SIZE } from '../constants'
import { useRosterTones } from '../hooks/use-roster-tones'
import {
  useActiveShift,
  useBulkDeleteEntries,
  useDeleteEntry,
  useScheduleBoard,
  useSwapShift,
} from '../hooks/use-scheduling'
import { FILTER_KEYS, type SchedulingSearch } from '../routing'
import type { BoardParams, ScheduleEntry } from '../types/scheduling.types'
import { downloadScheduleCsv } from '../utils/schedule-csv'
import {
  eachDay,
  formatRange,
  nextDay,
  periodRange,
  shiftAnchor,
  toDay,
} from '../utils/schedule-dates'
import { ApplyDefaultShiftDialog } from './dialogs/apply-default-shift-dialog'
import { CreateScheduleDialog } from './dialogs/create-schedule-dialog'
import { DeleteScheduleDialog } from './dialogs/delete-schedule-dialog'
import { EditEntryDialog } from './dialogs/edit-entry-dialog'
import { ImportScheduleDialog } from './dialogs/import-schedule-dialog'
import { MultiEditDialog } from './dialogs/multi-edit-dialog'
import { RestDayDialog } from './dialogs/rest-day-dialog'
import { SwapShiftDialog } from './dialogs/swap-shift-dialog'
import { TrashConfirmDialog } from './dialogs/trash-confirm-dialog'
import { ViewEntryDialog } from './dialogs/view-entry-dialog'
import { ScheduleBoard } from './schedule-board'
import { SchedulingFilters } from './scheduling-filters'
import { SchedulingHeader } from './scheduling-header'
import { schedulingType } from './type-styles'
import { YearBoard } from './year-board'

const routeApi = getRouteApi('/_app/scheduling')

/** Longest custom Date From → Date To range shown as days. */
const MAX_CUSTOM_DAYS = 93

type DialogState =
  | { type: 'create'; employeeIds?: string[]; date?: string }
  | { type: 'rest-day'; employeeIds?: string[]; date?: string }
  | { type: 'apply-default' }
  | { type: 'delete-range' }
  | { type: 'import' }
  | { type: 'edit' | 'view' | 'swap' | 'delete-entry'; entry: ScheduleEntry }
  | { type: 'multi-edit' }
  | { type: 'multi-delete' }
  | null

function boardParams(search: SchedulingSearch, from: string, to: string): BoardParams {
  return {
    scope: search.scope,
    from,
    to,
    page: search.page,
    pageSize: BOARD_PAGE_SIZE,
    ...(search.q ? { search: search.q } : {}),
    ...(search.status !== 'all' ? { status: search.status } : {}),
    ...(search.group ? { group: search.group } : {}),
    ...(search.locationId ? { locationId: search.locationId } : {}),
    ...(search.branchId ? { branchId: search.branchId } : {}),
    ...(search.department ? { department: search.department } : {}),
    ...(search.employeeId ? { employeeId: search.employeeId } : {}),
    ...(search.employmentType ? { employmentType: search.employmentType } : {}),
    ...(search.rosterGroupId ? { rosterGroupId: search.rosterGroupId } : {}),
  }
}

/**
 * Scheduling: who works which shift on which day. My / All / Subordinates
 * tabs, a week, month or year grid, and every action from the designs:
 * Create Scheduling, Apply Default Shift, Delete, Import / Export, Enable /
 * Disable Multiselect (Multi Edit, Multi Delete), and per shift Edit, View,
 * Swap (drag a shift onto another cell) and Delete.
 */
export function SchedulingPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [today] = useState(() => toDay(new Date()))
  const [multiselect, setMultiselect] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [exporting, setExporting] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const anchor = search.date ?? today
  const custom = search.from !== undefined && search.to !== undefined
  const period = custom
    ? { from: search.from ?? anchor, to: search.to ?? anchor }
    : periodRange(search.view, anchor)
  const isYear = search.view === 'year' && !custom
  const days = isYear ? [] : eachDay(period.from, period.to).slice(0, MAX_CUSTOM_DAYS)
  const to = isYear ? period.to : (days.at(-1) ?? period.to)
  const params = boardParams(search, period.from, to)

  const board = useScheduleBoard(params)
  const activeShift = useActiveShift()
  const tones = useRosterTones()
  const swap = useSwapShift()
  const deleteEntry = useDeleteEntry()
  const bulkDelete = useBulkDeleteEntries()

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
  const meta = board.data?.meta
  const activeFilterCount = FILTER_KEYS.filter((key) => search[key] !== undefined).length

  const move = (entryId: string, employeeId: string, date: string) => {
    swap.mutate({ entryId, targetEmployeeId: employeeId, targetDate: date })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = []
      for (let page = 1; ; page += 1) {
        const result = await schedulingApi.board({ ...params, page, pageSize: 100 })
        all.push(...result.data)
        if (page >= result.meta.totalPages) break
      }
      downloadScheduleCsv(all, `schedule-${period.from}-to-${to}.csv`, tones.titleOf)
      toast.success(`Exported ${all.length} employee${all.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not export the schedule. Try again.')
    } finally {
      setExporting(false)
    }
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
          void board.refetch()
          void activeShift.refetch()
        }}
        isRefreshing={board.isFetching && !board.isPending}
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
          if (!exporting) void exportCsv()
        }}
        onImport={() => {
          setDialog({ type: 'import' })
        }}
        filters={
          <SchedulingFilters
            search={search}
            rosterOptions={tones.groups.map((group) => ({ value: group.id, label: group.title }))}
            onChange={(patch) => {
              void update({ ...patch, page: 1 }, true)
            }}
            onClear={() => {
              void update(
                {
                  ...Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])),
                  status: 'active',
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
          {board.error && !board.data ? (
            <ErrorState
              message={board.error.message}
              onRetry={() => {
                void board.refetch()
              }}
              className="shadow-none"
            />
          ) : isYear ? (
            <YearBoard
              rows={rows}
              year={Number(period.from.slice(0, 4))}
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
              isLoading={board.isPending}
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
              dayTotals={board.data?.dayTotals ?? {}}
              isLoading={board.isPending}
              isFetching={board.isFetching}
              multiselect={multiselect}
              selectedIds={selected}
              canCreate={search.scope !== 'my'}
              toneFor={tones.toneFor}
              onToggleSelect={(entry) => {
                setSelected((current) => {
                  const next = new Set(current)
                  if (next.has(entry.id)) next.delete(entry.id)
                  else next.add(entry.id)
                  return next
                })
              }}
              onAction={(action, entry) => {
                setDialog({ type: action === 'delete' ? 'delete-entry' : action, entry })
              }}
              onMove={move}
              onNudge={(entry, delta) => {
                move(entry.id, entry.employeeId, nextDay(entry.date, delta))
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
              disabled={board.isPending}
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
      {dialog?.type === 'import' && <ImportScheduleDialog onClose={closeDialog} />}
      {dialog?.type === 'edit' && <EditEntryDialog entry={dialog.entry} onClose={closeDialog} />}
      {dialog?.type === 'view' && (
        <ViewEntryDialog
          entry={dialog.entry}
          onClose={closeDialog}
          onEdit={() => {
            setDialog({ type: 'edit', entry: dialog.entry })
          }}
        />
      )}
      {dialog?.type === 'swap' && (
        <SwapShiftDialog entry={dialog.entry} rows={rows} days={days} onClose={closeDialog} />
      )}
      {dialog?.type === 'multi-edit' && (
        <MultiEditDialog
          entryIds={[...selected]}
          onClose={closeDialog}
          onDone={() => {
            setSelected(new Set())
          }}
        />
      )}
      <TrashConfirmDialog
        open={dialog?.type === 'delete-entry' || dialog?.type === 'multi-delete'}
        pending={deleteEntry.isPending || bulkDelete.isPending}
        message={
          dialog?.type === 'delete-entry' && dialog.entry.kind === 'rest'
            ? 'Are you sure you want to delete this rest day?'
            : 'Are you sure you want to Delete this Schedule? Rest Days will not be Deleted.'
        }
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'delete-entry') {
            deleteEntry.mutate(dialog.entry.id, { onSettled: closeDialog })
          } else if (dialog?.type === 'multi-delete') {
            bulkDelete.mutate([...selected], {
              onSuccess: () => {
                setSelected(new Set())
              },
              onSettled: closeDialog,
            })
          }
        }}
      />
    </PageContainer>
  )
}
