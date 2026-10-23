import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

import { BUDGET_STATUS_META, DEFAULT_PAGE_SIZE } from '../../constants'
import { useBudgets, useDecideBudget } from '../../hooks/use-manpower'
import type { BudgetRow } from '../../types/manpower.types'
import { toastError } from '../../utils/errors'
import { formatAmount } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import { CheckIcon, CloseIcon, DeleteBudgetIcon, DetailsIcon } from '../shared/mp-icons'
import { mpTableClass } from '../shared/mp-styles'
import { CardBody, MpCard, MpPage } from '../shared/page-shell'
import { ConfirmPopup } from '../shared/popups'
import { RowMenu } from '../shared/row-menu'

const routeApi = getRouteApi('/_app/manpower-planning/budget-approvals')

type Decision = { budget: BudgetRow; decision: 'approve' | 'reject' } | null

/**
 * Budget Approvals ("Approvals"): every budget the plans asked for, waiting ones first,
 * with who decided it; ⋮ Approve (its new positions open on Open Positions), Reject,
 * or View Plan.
 */
export function BudgetApprovalsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [deciding, setDeciding] = useState<Decision>(null)
  const decide = useDecideBudget()
  const list = useBudgets({ page, pageSize, search: debounced })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<BudgetRow>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    { id: 'title', header: 'Positions', mobile: 'heading', cell: (row) => row.title },
    { id: 'amount', header: 'Budget', cell: (row) => formatAmount(row.amount) },
    { id: 'duration', header: 'Duration', cell: (row) => row.duration },
    {
      id: 'decided',
      header: 'Approved By',
      cell: (row) =>
        row.decided ? (
          <StampCell stamp={row.decided} />
        ) : (
          <span className="text-sm text-[#707070] dark:text-muted-foreground">
            Awaiting approval
          </span>
        ),
    },
    { id: 'added', header: 'Added on', cell: (row) => <StampCell stamp={row.added} /> },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <Chip {...BUDGET_STATUS_META[row.status]} />,
    },
  ]

  const approving = deciding?.decision === 'approve'
  return (
    <MpPage
      title="Budget Approvals"
      info="Approve or reject the budgets the plans ask for. Approving a budget opens its new positions on Open Positions; a plan is approved once all its budgets are."
      filtersOpen={filtersOpen}
      onToggleFilters={() => {
        setFiltersOpen((open) => !open)
      }}
    >
      <MpCard title="Approvals">
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
              label="Search approvals"
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
            message="The approvals could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Budget approvals"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState={
              debounced ? 'No budget matches your search.' : 'There are no budgets to approve.'
            }
            rowActionsHeader="Action"
            rowActions={(row) => (
              <RowMenu
                label={`Actions for ${row.title} ${row.duration}`}
                items={[
                  {
                    label: 'Approve',
                    icon: CheckIcon,
                    disabled: row.status !== 'pending',
                    onSelect: () => {
                      setDeciding({ budget: row, decision: 'approve' })
                    },
                  },
                  {
                    label: 'Reject',
                    icon: CloseIcon,
                    disabled: row.status !== 'pending',
                    onSelect: () => {
                      setDeciding({ budget: row, decision: 'reject' })
                    },
                  },
                  {
                    label: 'View Plan',
                    icon: DetailsIcon,
                    disabled: row.planId === null,
                    onSelect: () => {
                      if (row.planId) {
                        void navigate({
                          to: '/manpower-planning/planning/$planId',
                          params: { planId: row.planId },
                        })
                      }
                    },
                  },
                ]}
              />
            )}
          />
        )}
        <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />
      </MpCard>

      <ConfirmPopup
        open={deciding !== null}
        onOpenChange={(open) => {
          if (!open) setDeciding(null)
        }}
        title={approving ? 'Approve Budget' : 'Reject Budget'}
        icon={DeleteBudgetIcon}
        message={
          approving
            ? `Are you sure you want to Approve this budget? ${deciding.budget.positions > 0 ? `${String(deciding.budget.positions)} open ${deciding.budget.positions === 1 ? 'position' : 'positions'} will be added.` : ''}`.trim()
            : 'Are you sure you want to Reject this budget?'
        }
        confirmLabel={approving ? 'Approve' : 'Reject'}
        onConfirm={() => {
          if (!deciding) return
          decide.mutate(
            { id: deciding.budget.id, decision: deciding.decision },
            { onError: toastError('The decision could not be saved.') },
          )
        }}
      />
    </MpPage>
  )
}
