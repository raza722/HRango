import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { FormField } from '@/components/form'
import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { CYCLE_STATUS_META, metaOf, PERF_CODES, PERF_PAGE_SIZES } from '../../constants'
import {
  useCycle,
  useCycleActions,
  useCycleList,
  useDeleteCycle,
} from '../../hooks/use-performance'
import type { CyclesSearch } from '../../routing'
import { type Cycle, CYCLE_STATUSES } from '../../types/performance.types'
import { type CycleAction, cycleConfirmCopy } from '../../utils/cycles'
import { formatDate, formatPeriod, serialOf } from '../../utils/format'
import { navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { FiltersDialog } from '../shared/dialogs'
import {
  Chip,
  ConfirmAction,
  FilterButton,
  PageHeaderCard,
  ProgressBar,
  SearchBox,
} from '../shared/parts'
import { CycleDetailDialog } from './cycle-detail-dialog'
import { CycleFormDialog } from './cycle-form-dialog'

const routeApi = getRouteApi('/_app/performance/cycles')

function StatusFilterDialog({
  value,
  onApply,
  onClose,
}: {
  value: CyclesSearch['status']
  onApply: (status: CyclesSearch['status']) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <FiltersDialog
      onApply={() => {
        onApply(draft)
      }}
      onReset={() => {
        onApply(undefined)
      }}
      onClose={onClose}
    >
      <FormField label="Status">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft ?? null}
            onChange={(next) => {
              setDraft(CYCLE_STATUSES.find((status) => status === next))
            }}
            options={CYCLE_STATUSES.map((status) => ({
              value: status,
              label: CYCLE_STATUS_META[status].label,
            }))}
            placeholder="All Statuses"
            clearable
          />
        )}
      </FormField>
    </FiltersDialog>
  )
}

/** Edit from the URL: the row on this page, or the cycle read on its own. */
function CycleEditLoader({
  row,
  cycleId,
  onClose,
}: {
  row: Cycle | null
  cycleId: string
  onClose: () => void
}) {
  const detail = useCycle(cycleId)
  const cycle = detail.data ?? row
  return cycle ? <CycleFormDialog key={cycle.rowVersion} cycle={cycle} onClose={onClose} /> : null
}

/**
 * Review Cycles: every cycle with its form, period, due dates, participants and how many are
 * finalised; Add / Edit, the detail with its participants, Launch for a draft, Close for an
 * active one, and Delete for a draft. Search, status, page and the open popup live in the URL.
 */
export function CyclesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(PERF_CODES.cyclesCreate)
  const canEdit = useCan(PERF_CODES.cyclesEdit)
  const canDelete = useCan(PERF_CODES.cyclesDelete)
  const canParticipants = useCan(PERF_CODES.cyclesParticipants)
  const cycleActions = useCycleActions()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [confirming, setConfirming] = useState<{
    cycle: Cycle
    action: CycleAction
  } | null>(null)
  const remove = useDeleteCycle()

  const update = (patch: Partial<CyclesSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const list = useCycleList({
    status: search.status,
    q: search.q,
    page: search.page,
    pageSize: search.pageSize,
  })
  const page = list.data?.meta.page ?? search.page

  const columns: DataTableColumn<Cycle>[] = [
    {
      id: 'serial',
      header: 'Sr. #',
      mobile: 'hidden',
      className: 'w-14',
      cell: (_row, index) => serialOf(page, search.pageSize, index),
    },
    {
      id: 'cycle',
      header: 'Cycle',
      mobile: 'heading',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <button
            type="button"
            onClick={() => {
              update({ cycle: row.id })
            }}
            className="w-fit text-left text-xs font-medium text-person outline-none hover:underline focus-visible:underline dark:text-heading"
          >
            {row.name}
          </button>
          <span className="text-[0.625rem] text-grey">{row.formName}</span>
        </span>
      ),
    },
    { id: 'period', header: 'Period', cell: (row) => formatPeriod(row.startDate, row.endDate) },
    { id: 'selfDue', header: 'Self Review Due', cell: (row) => formatDate(row.selfReviewDueDate) },
    {
      id: 'managerDue',
      header: 'Manager Review Due',
      cell: (row) => formatDate(row.managerReviewDueDate),
    },
    { id: 'participants', header: 'Participants', align: 'right', cell: (row) => row.participants },
    {
      id: 'finalised',
      header: 'Finalised',
      className: 'min-w-36',
      cell: (row) => (
        <ProgressBar
          value={row.finalised}
          max={Math.max(1, row.participants)}
          label={`Finalised in ${row.name}: ${String(row.finalised)} of ${String(row.participants)}`}
          text={`${String(row.finalised)} / ${String(row.participants)}`}
          className="[&>span:last-child]:w-14"
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={metaOf(CYCLE_STATUS_META, row.status)} />,
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => (
        <RowActionsMenu
          label={`Actions for ${row.name}`}
          itemClassName={rowMenuItemClass.poppins}
          actions={[
            {
              label: canParticipants && row.status !== 'closed' ? 'Participants' : 'View',
              onSelect: () => {
                update({ cycle: row.id })
              },
            },
            ...(canEdit && row.status !== 'closed'
              ? [
                  {
                    label: 'Edit',
                    onSelect: () => {
                      update({ edit: row.id, dialog: undefined })
                    },
                  },
                ]
              : []),
            ...(cycleActions.canLaunch && row.status === 'draft'
              ? [
                  {
                    // A cycle without people cannot launch; the item says why.
                    label: row.participants === 0 ? 'Launch (add participants first)' : 'Launch',
                    disabled: row.participants === 0,
                    onSelect: () => {
                      setConfirming({ cycle: row, action: 'launch' })
                    },
                  },
                ]
              : []),
            ...(cycleActions.canClose && row.status === 'active'
              ? [
                  {
                    label: 'Close Cycle',
                    onSelect: () => {
                      setConfirming({ cycle: row, action: 'close' })
                    },
                  },
                ]
              : []),
            ...(canDelete && row.status === 'draft'
              ? [
                  {
                    label: 'Delete',
                    variant: 'destructive' as const,
                    onSelect: () => {
                      setConfirming({ cycle: row, action: 'delete' })
                    },
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeaderCard
        title="Review Cycles"
        description="A cycle reviews its participants on an appraisal form: add people, launch it, and close it when the appraisals are finalised."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'add', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
            >
              + Add Cycle
            </Button>
          )
        }
      />
      <PaginatedTableCard
        title="Cycles"
        titleAs="h2"
        caption="Review Cycles"
        className={tableClass}
        toolbar={
          <>
            <SearchBox
              key={search.q ?? ''}
              value={search.q}
              label="Search review cycles"
              onSearch={(q) => {
                update({ q, page: 1 })
              }}
            />
            <FilterButton
              count={search.status ? 1 : 0}
              onClick={() => {
                setFiltersOpen(true)
              }}
            />
          </>
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
          search.q || search.status
            ? 'No review cycles match the search or filter.'
            : 'No review cycles yet. + Add Cycle sets up the first one.'
        }
      />

      {search.dialog === 'add' && (
        <CycleFormDialog
          cycle={null}
          onClose={() => {
            update({ dialog: undefined })
          }}
        />
      )}
      {search.edit && (
        <CycleEditLoader
          row={list.data?.data.find((cycle) => cycle.id === search.edit) ?? null}
          cycleId={search.edit}
          onClose={() => {
            update({ edit: undefined })
          }}
        />
      )}
      {search.cycle && (
        <CycleDetailDialog
          cycleId={search.cycle}
          onEdit={(cycle) => {
            update({ cycle: undefined, edit: cycle.id })
          }}
          onClose={() => {
            update({ cycle: undefined })
          }}
        />
      )}
      {filtersOpen && (
        <StatusFilterDialog
          value={search.status}
          onApply={(status) => {
            update({ status, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
      {confirming && (
        <ConfirmAction
          title={cycleConfirmCopy(confirming.cycle, confirming.action).title}
          description={cycleConfirmCopy(confirming.cycle, confirming.action).text}
          confirmLabel={cycleConfirmCopy(confirming.cycle, confirming.action).label}
          destructive={confirming.action === 'delete'}
          onConfirm={() => {
            const { cycle, action } = confirming
            const variables = { id: cycle.id, rowVersion: cycle.rowVersion, name: cycle.name }
            if (action === 'launch') cycleActions.launch.mutate(variables)
            else if (action === 'close') cycleActions.close.mutate(variables)
            else remove.mutate(variables)
          }}
          onClose={() => {
            setConfirming(null)
          }}
        />
      )}
    </PageContainer>
  )
}
