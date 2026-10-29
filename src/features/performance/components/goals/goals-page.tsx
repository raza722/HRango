import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PERF_CODES, PERF_PAGE_SIZES, SCOPE_LABELS } from '../../constants'
import { useDeleteGoal, useGoal, useGoalList } from '../../hooks/use-performance'
import type { GoalsSearch } from '../../routing'
import type { Goal, GoalDetail, ScopeTab } from '../../types/performance.types'
import { formatDate, formatNumber, serialOf } from '../../utils/format'
import { navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import {
  ConfirmAction,
  FilterButton,
  GoalStatusChips,
  PageHeaderCard,
  ProgressBar,
  ScopeTabsBar,
  SearchBox,
} from '../shared/parts'
import { CheckInDialog } from './check-in-dialog'
import { type GoalActions, GoalDetailDialog } from './goal-detail-dialog'
import { type GoalFilters, GoalFiltersDialog } from './goal-filters-dialog'
import { GoalFormDialog } from './goal-form-dialog'

const routeApi = getRouteApi('/_app/performance/goals')

const TITLES: Record<ScopeTab, string> = { my: 'My Goals', team: 'Team Goals', all: 'All Goals' }

/** The goal's title: opens its detail (stretched over the row in the stacked layout). */
function GoalCell({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="w-fit text-left text-xs font-medium text-person outline-none hover:underline focus-visible:underline dark:text-heading"
      >
        {goal.title}
      </button>
      {goal.kpiName && <span className="text-[0.625rem] text-grey">KPI: {goal.kpiName}</span>}
    </span>
  )
}

/**
 * Goals: My / Team / All, the search and filters (status, cycle, employee, due dates,
 * overdue), the table with progress bars, and the Add / Edit, detail and Check In popups.
 * Everything that picks what shows, and the open popup, lives in the URL.
 */
export function GoalsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canTeam = useCan(PERF_CODES.goalsTeam)
  const canAll = useCan(PERF_CODES.goalsAll)
  const canCreate = useCan(PERF_CODES.goalsCreate)
  const canEdit = useCan(PERF_CODES.goalsEdit)
  const canDelete = useCan(PERF_CODES.goalsDelete)
  const canCheckIn = useCan(PERF_CODES.goalsCheckIn)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const remove = useDeleteGoal()

  const tabs: ScopeTab[] = [
    'my',
    ...(canTeam ? (['team'] as const) : []),
    ...(canAll ? (['all'] as const) : []),
  ]
  const tab = tabs.includes(search.tab) ? search.tab : 'my'
  const update = (patch: Partial<GoalsSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }

  const list = useGoalList({
    tab,
    status: search.status,
    cycleId: search.cycleId,
    overdue: search.overdue,
    dueFrom: search.dueFrom,
    dueTo: search.dueTo,
    q: search.q,
    employeeId: tab === 'my' ? undefined : search.employeeId,
    page: search.page,
    pageSize: search.pageSize,
  })

  const filters: GoalFilters = {
    status: search.status,
    cycleId: search.cycleId,
    overdue: search.overdue,
    dueFrom: search.dueFrom,
    dueTo: search.dueTo,
    employeeId: tab === 'my' ? undefined : search.employeeId,
  }
  const filterCount = Object.values(filters).filter(Boolean).length
  const page = list.data?.meta.page ?? search.page

  const actions: GoalActions = {
    canCheckIn,
    canEdit,
    canDelete,
    onCheckIn: (goal: GoalDetail) => {
      update({ checkIn: goal.id, goal: undefined })
    },
    onEdit: (goal: GoalDetail) => {
      update({ edit: goal.id, goal: undefined })
    },
    onDelete: (goal: GoalDetail) => {
      update({ goal: undefined })
      setDeleting(goal)
    },
  }

  const columns: DataTableColumn<Goal>[] = [
    {
      id: 'serial',
      header: 'Sr. #',
      mobile: 'hidden',
      className: 'w-14',
      cell: (_row, index) => serialOf(page, search.pageSize, index),
    },
    {
      id: 'goal',
      header: 'Goal',
      mobile: 'heading',
      className: 'min-w-52 whitespace-normal',
      cell: (row) => (
        <GoalCell
          goal={row}
          onOpen={() => {
            update({ goal: row.id })
          }}
        />
      ),
    },
    ...(tab === 'my'
      ? []
      : [
          {
            id: 'employee',
            header: 'Employee',
            className: 'min-w-36 whitespace-normal',
            cell: (row: Goal) => (
              <span className="grid">
                <span className="font-medium">{row.employeeName}</span>
                <span className="text-[0.625rem] text-grey">{row.employeeCode}</span>
              </span>
            ),
          },
        ]),
    {
      id: 'cycle',
      header: 'Review Cycle',
      className: 'whitespace-normal',
      cell: (row) => row.cycleName ?? '—',
    },
    { id: 'due', header: 'Due Date', cell: (row) => formatDate(row.dueDate) },
    {
      id: 'weight',
      header: 'Weight',
      align: 'right',
      cell: (row) => `${formatNumber(row.weight)}%`,
    },
    {
      id: 'progress',
      header: 'Progress',
      className: 'min-w-36',
      cell: (row) => <ProgressBar value={row.progress} label={`Progress of ${row.title}`} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <GoalStatusChips status={row.status} isOverdue={row.isOverdue} isLocked={row.isLocked} />
      ),
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => {
        const open = !row.isLocked
        return (
          <RowActionsMenu
            label={`Actions for ${row.title}`}
            itemClassName={rowMenuItemClass.poppins}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  update({ goal: row.id })
                },
              },
              ...(open && canCheckIn
                ? [
                    {
                      label: 'Check In',
                      onSelect: () => {
                        update({ checkIn: row.id })
                      },
                    },
                  ]
                : []),
              ...(open && canEdit
                ? [
                    {
                      label: 'Edit',
                      onSelect: () => {
                        update({ edit: row.id, dialog: undefined })
                      },
                    },
                  ]
                : []),
              ...(open && canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDeleting(row)
                      },
                    },
                  ]
                : []),
            ]}
          />
        )
      },
    },
  ]

  const checkInGoal = search.checkIn
    ? (list.data?.data.find((goal) => goal.id === search.checkIn) ?? null)
    : null

  return (
    <PageContainer>
      <PageHeaderCard
        title="Goals"
        description="Set goals with a weight and a due date, link them to a KPI and check in as they move."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'add', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
            >
              + Add Goal
            </Button>
          )
        }
      />

      <PaginatedTableCard
        title={TITLES[tab]}
        titleAs="h2"
        caption={TITLES[tab]}
        className={tableClass}
        toolbar={
          <div className="grid w-full gap-3">
            <ScopeTabsBar
              tabs={tabs}
              value={tab}
              label="Whose goals"
              onChange={(next) => {
                update({ tab: next, page: 1, employeeId: undefined })
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                key={search.q ?? ''}
                value={search.q}
                label="Search goals"
                onSearch={(q) => {
                  update({ q, page: 1 })
                }}
              />
              <FilterButton
                count={filterCount}
                onClick={() => {
                  setFiltersOpen(true)
                }}
              />
            </div>
          </div>
        }
        columns={columns}
        result={list}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={PERF_PAGE_SIZES}
        onPageChange={(next) => {
          update({ page: next })
        }}
        onPageSizeChange={(size) => {
          update({ pageSize: size, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          search.q || filterCount > 0
            ? 'No goals match the search or filters.'
            : tab === 'my'
              ? 'You have no goals yet. + Add Goal sets the first one.'
              : `No ${SCOPE_LABELS[tab].toLowerCase()} goals yet.`
        }
      />

      {(search.dialog === 'add' || search.edit) && (
        <GoalFormDialog
          goalId={search.edit ?? null}
          onClose={() => {
            update({ dialog: undefined, edit: undefined })
          }}
        />
      )}
      {search.goal && (
        <GoalDetailDialog
          goalId={search.goal}
          actions={actions}
          onClose={() => {
            update({ goal: undefined })
          }}
        />
      )}
      {search.checkIn && (
        <CheckInLoader
          goal={checkInGoal}
          goalId={search.checkIn}
          onClose={() => {
            update({ checkIn: undefined })
          }}
        />
      )}
      {filtersOpen && (
        <GoalFiltersDialog
          value={filters}
          showEmployee={tab !== 'my'}
          onApply={(next) => {
            update({ ...next, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
      {deleting && (
        <ConfirmAction
          title="Delete goal"
          description={`Delete “${deleting.title}”? Its check-ins go with it.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            remove.mutate({
              id: deleting.id,
              rowVersion: deleting.rowVersion,
              title: deleting.title,
            })
          }}
          onClose={() => {
            setDeleting(null)
          }}
        />
      )}
    </PageContainer>
  )
}

/** Check In from the URL: the goal as read on its own, else its row on this page. */
function CheckInLoader({
  goal,
  goalId,
  onClose,
}: {
  goal: Goal | null
  goalId: string
  onClose: () => void
}) {
  const detail = useGoal(goalId)
  const shown = detail.data ?? goal
  return shown ? <CheckInDialog key={shown.rowVersion} goal={shown} onClose={onClose} /> : null
}
