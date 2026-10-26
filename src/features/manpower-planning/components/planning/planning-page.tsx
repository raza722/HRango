import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { DEFAULT_PAGE_SIZE, MP_CODES, PLAN_MODE_LABELS, PLAN_STATUS_META } from '../../constants'
import { useDeletePlan, useManpowerLookups, usePlans } from '../../hooks/use-manpower'
import { type Plan, PLAN_MODES, PLAN_STATUSES } from '../../types/manpower.types'
import { formatAmount, stampOf } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpField, MpListFooter, MpSelect } from '../shared/controls'
import {
  AddIcon,
  ApprovalsIcon,
  CheckIcon,
  DeleteIcon,
  DeletePlanIcon,
  DetailsIcon,
  EditIcon,
  RefreshIcon,
  SearchIcon,
} from '../shared/mp-icons'
import {
  accent,
  boxClass,
  headerButton,
  listBoxClass,
  mpTableClass,
  smallButton,
} from '../shared/mp-styles'
import { MpCard, MpPage } from '../shared/page-shell'
import { ConfirmPopup } from '../shared/popups'
import { RowMenu } from '../shared/row-menu'
import { PlanApprovalsDialog } from './plan-approvals-dialog'

const routeApi = getRouteApi('/_app/manpower-planning/planning/')

interface Filters {
  q: string
  mode: string
  status: string
  current: string
}
const NO_FILTERS: Filters = { q: '', mode: '', status: '', current: '' }

const iconCell =
  'inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35'

/**
 * Planning ("Employee Planning"): every plan with its monthly and annual amounts,
 * plan year, whether that year is the current budget period, status and who added it;
 * Details opens the plan, Approvals its budgets' decisions, ⋮ Edit or Delete.
 */
export function PlanningPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const lookups = useManpowerLookups()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [durationId, setDurationId] = useState('')
  const [approvalsOf, setApprovalsOf] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const remove = useDeletePlan()
  const canCreate = useCan(MP_CODES.planningCreate)
  const canEdit = useCan(MP_CODES.planningEdit)
  const canDelete = useCan(MP_CODES.planningDelete)
  const list = usePlans({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    q: applied.q,
    mode: applied.mode,
    status: applied.status,
    isCurrent: applied.current === 'yes' ? true : undefined,
    budgetDurationId: durationId,
  })

  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const offset = (page - 1) * DEFAULT_PAGE_SIZE

  const columns: DataTableColumn<Plan>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    {
      id: 'title',
      header: 'Title',
      mobile: 'heading',
      className: 'min-w-[4.5rem] max-w-[7rem] whitespace-normal',
      cell: (row) => row.title,
    },
    { id: 'monthly', header: 'Monthly Amount', cell: (row) => formatAmount(row.monthlyAmount) },
    { id: 'annual', header: 'Annual Amount', cell: (row) => formatAmount(row.annualAmount) },
    { id: 'year', header: 'Planning Year', cell: (row) => row.budgetDurationName },
    {
      id: 'current',
      header: 'Current Planning',
      align: 'center',
      cell: (row) =>
        row.isCurrent ? (
          <span className={cn('inline-flex', accent.text)}>
            <CheckIcon aria-hidden="true" className="h-3.5 w-[1.1875rem]" />
            <span className="sr-only">Current</span>
          </span>
        ) : (
          <span className="sr-only">No</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip {...PLAN_STATUS_META[row.status]} size="sm" />,
    },
    {
      id: 'added',
      header: 'Added On',
      cell: (row) => <StampCell stamp={stampOf(row.createdAt, row.createdByName)} size="sm" />,
    },
    {
      id: 'details',
      header: 'Details',
      align: 'center',
      cell: (row) => (
        <Link
          to="/manpower-planning/planning/$planId"
          params={{ planId: row.id }}
          aria-label={`Details of ${row.title}`}
          className={cn(iconCell, 'text-[#868686]')}
        >
          <DetailsIcon className="h-[1.1875rem] w-[0.9375rem]" />
        </Link>
      ),
    },
    {
      id: 'approvals',
      header: 'Approvals',
      align: 'center',
      cell: (row) => (
        <button
          type="button"
          aria-label={`Approvals of ${row.title}`}
          onClick={() => {
            setApprovalsOf(row.id)
          }}
          className={cn(iconCell, accent.text)}
        >
          <ApprovalsIcon className="size-[1.2rem]" />
        </button>
      ),
    },
  ]

  const setField = (field: keyof Filters) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }
  const durations = lookups.data?.durations ?? []

  return (
    <MpPage
      title="Manpower Planning"
      info="Plan the positions a team needs for a plan year: new positions to hire and the people already in post. A submitted plan sends one budget per position to Budget Approvals; approved budgets open their positions."
      filtersOpen={filtersOpen}
      onToggleFilters={() => {
        setFiltersOpen((open) => !open)
      }}
    >
      <MpCard
        title="Employee Planning"
        actions={
          <>
            {canCreate && (
              <Link to="/manpower-planning/planning/new" className={cn(headerButton, accent.bg)}>
                <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
                Add New Plan
              </Link>
            )}
            <div className="flex items-center gap-1">
              <span className="text-sm text-heading">Showing:</span>
              <MpSelect
                aria-label="Plan year shown"
                value={durationId}
                onChange={(value) => {
                  setDurationId(value)
                  goTo(1)
                }}
                noneLabel="All Plan Years"
                placeholder="All Plan Years"
                options={durations.map((item) => ({ value: item.id, label: item.name }))}
                className={cn(
                  listBoxClass,
                  'h-[2.6875rem] w-[8.5625rem] rounded-none px-3 text-sm',
                )}
              />
            </div>
          </>
        }
      >
        {filtersOpen && (
          <form
            aria-label="Plan filters"
            className="grid grid-cols-1 gap-3 px-4 sm:px-6 @md:grid-cols-2 @3xl:grid-cols-[repeat(4,minmax(0,11.875rem))_auto] @3xl:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setApplied(draft)
              goTo(1)
            }}
          >
            <MpField label="Planning Title">
              {(a11y) => (
                <input
                  {...a11y}
                  value={draft.q}
                  onChange={(event) => {
                    setField('q')(event.target.value)
                  }}
                  className={cn(boxClass, 'w-full')}
                />
              )}
            </MpField>
            <MpField label="Planning Mode">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={draft.mode}
                  onChange={setField('mode')}
                  noneLabel="Any"
                  placeholder="Any"
                  options={PLAN_MODES.map((mode) => ({
                    value: mode,
                    label: PLAN_MODE_LABELS[mode],
                  }))}
                />
              )}
            </MpField>
            <MpField label="Status">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={draft.status}
                  onChange={setField('status')}
                  noneLabel="Any"
                  placeholder="Any"
                  options={PLAN_STATUSES.map((status) => ({
                    value: status,
                    label: PLAN_STATUS_META[status].label,
                  }))}
                />
              )}
            </MpField>
            <MpField label="Current Planning">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={draft.current}
                  onChange={setField('current')}
                  noneLabel="Any"
                  placeholder="Any"
                  options={[{ value: 'yes', label: 'Current plan year only' }]}
                />
              )}
            </MpField>
            <div className="flex gap-2.5 @md:col-span-2 @3xl:col-span-1">
              <button type="submit" className={cn(smallButton, accent.bg, 'w-[5.4375rem]')}>
                <SearchIcon aria-hidden="true" className="size-[1.055rem]" />
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(NO_FILTERS)
                  setApplied(NO_FILTERS)
                  setDurationId('')
                  goTo(1)
                  void list.refetch()
                }}
                className={cn(smallButton, accent.bg, 'w-[5.4375rem]')}
              >
                <RefreshIcon aria-hidden="true" className="h-[1.13rem] w-[0.85rem]" />
                Refresh
              </button>
            </div>
          </form>
        )}

        {list.isError ? (
          <ErrorState
            message="The plans could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Employee plans"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState="No plans match. Add a new plan or change the filters."
            rowActionsHeader="Action"
            rowActions={
              canEdit || canDelete
                ? (row) => (
                    <RowMenu
                      label={`Actions for ${row.title}`}
                      items={[
                        ...(canEdit
                          ? [
                              {
                                label: 'Edit',
                                icon: EditIcon,
                                onSelect: () => {
                                  void navigate({
                                    to: '/manpower-planning/planning/$planId/edit',
                                    params: { planId: row.id },
                                  })
                                },
                              },
                            ]
                          : []),
                        ...(canDelete
                          ? [
                              {
                                label: 'Delete',
                                icon: DeleteIcon,
                                disabled: row.isLocked,
                                onSelect: () => {
                                  setDeleting(row)
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  )
                : undefined
            }
          />
        )}
        <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />
      </MpCard>

      {approvalsOf && (
        <PlanApprovalsDialog
          planId={approvalsOf}
          onClose={() => {
            setApprovalsOf(null)
          }}
        />
      )}
      <ConfirmPopup
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Plan Year"
        icon={DeletePlanIcon}
        message="Are you sure you want to Delete this plan?"
        confirmLabel="Delete Plan Year"
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting, {
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'The plan could not be deleted.',
              )
            },
          })
        }}
      />
    </MpPage>
  )
}
