import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { BUDGET_STATUS_META, DEFAULT_PAGE_SIZE, MP_CODES } from '../../constants'
import { useBudgets, useDeleteBudget } from '../../hooks/use-manpower'
import type { Budget } from '../../types/manpower.types'
import { toastError } from '../../utils/errors'
import { formatAmount, formatDay, stampOf } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import { AddIcon, DeleteBudgetIcon, DeleteIcon, EditIcon } from '../shared/mp-icons'
import { accent, headerButton, mpTableClass } from '../shared/mp-styles'
import { CardBody, MpCard, MpPage } from '../shared/page-shell'
import { ConfirmPopup } from '../shared/popups'
import { RowMenu } from '../shared/row-menu'
import { BudgetDialog } from './budget-dialog'

const routeApi = getRouteApi('/_app/manpower-planning/e-budgeting')

/**
 * E-Budgeting: the budget asked for each position of a plan year (made when a plan is
 * submitted), with its amount, dates, who added it and its status; ⋮ Edit or Delete
 * while it waits for approval.
 */
export function EBudgetingPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [editing, setEditing] = useState<{ budget: Budget | null } | null>(null)
  const [deleting, setDeleting] = useState<Budget | null>(null)
  const remove = useDeleteBudget()
  const canCreate = useCan(MP_CODES.budgetCreate)
  const canEdit = useCan(MP_CODES.budgetEdit)
  const canDelete = useCan(MP_CODES.budgetDelete)
  const list = useBudgets({ page, pageSize, q: debounced })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<Budget>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    { id: 'title', header: 'Title', mobile: 'heading', cell: (row) => row.title },
    {
      id: 'duration',
      header: 'Budget Duration',
      align: 'center',
      cell: (row) => row.budgetDurationName,
    },
    { id: 'amount', header: 'Budget Amount', cell: (row) => formatAmount(row.amount) },
    { id: 'start', header: 'Start Date', cell: (row) => formatDay(row.startDate) },
    { id: 'end', header: 'End Date', cell: (row) => formatDay(row.endDate) },
    {
      id: 'added',
      header: 'Added On',
      cell: (row) => <StampCell stamp={stampOf(row.createdAt, row.createdByName)} />,
    },
    {
      id: 'status',
      header: <span className="sr-only">Status</span>,
      cell: (row) => <Chip {...BUDGET_STATUS_META[row.status]} />,
    },
  ]

  return (
    <MpPage
      title="Manpower Planning"
      info="E-Budgeting lists the budget each submitted plan asks for, one per position title and department, and the budgets added here by hand. A budget can be changed or deleted until it is approved on Budget Approvals."
      filtersOpen={filtersOpen}
      onToggleFilters={() => {
        setFiltersOpen((open) => !open)
      }}
    >
      <MpCard
        title="E-Budgeting"
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => {
                setEditing({ budget: null })
              }}
              className={cn(headerButton, accent.bg)}
            >
              <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
              Add Budget
            </button>
          ) : undefined
        }
      >
        {filtersOpen && (
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <ShowEntries
              value={pageSize}
              onChange={(size) => {
                setPageSize(size)
                goTo(1)
              }}
            />
            <SearchBox
              label="Search budgets"
              value={search}
              onChange={(value) => {
                setSearch(value)
                goTo(1)
              }}
            />
          </CardBody>
        )}
        {list.isError ? (
          <ErrorState
            message="The budgets could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Budgets"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState={
              debounced
                ? 'No budget matches your search.'
                : 'No budgets yet. Submit a plan to ask for one.'
            }
            rowActionsHeader="Action"
            rowActions={
              canEdit || canDelete
                ? (row) => (
                    <RowMenu
                      label={`Actions for ${row.title} ${row.budgetDurationName}`}
                      items={[
                        ...(canEdit
                          ? [
                              {
                                label: 'Edit',
                                icon: EditIcon,
                                onSelect: () => {
                                  if (row.status === 'approved') {
                                    toast.error(
                                      'This budget is approved, so it can no longer be changed.',
                                    )
                                  } else setEditing({ budget: row })
                                },
                              },
                            ]
                          : []),
                        ...(canDelete
                          ? [
                              {
                                label: 'Delete',
                                icon: DeleteIcon,
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

      {editing && (
        <BudgetDialog
          budget={editing.budget}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      <ConfirmPopup
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Budget"
        icon={DeleteBudgetIcon}
        message="Are you sure you want to Delete this budget?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting)
            remove.mutate(deleting, { onError: toastError('The budget could not be deleted.') })
        }}
      />
    </MpPage>
  )
}
