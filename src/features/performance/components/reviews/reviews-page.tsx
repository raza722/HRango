import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { FormField } from '@/components/form'
import { type DataTableColumn, PageContainer, PaginatedTableCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  APPRAISAL_STATUS_META,
  appraisalStatusMeta,
  PERF_CODES,
  PERF_PAGE_SIZES,
} from '../../constants'
import {
  useCycleOptions,
  useMyEmployeeId,
  useReviewList,
  useReviewRights,
} from '../../hooks/use-performance'
import type { ReviewsSearch } from '../../routing'
import { type Appraisal, APPRAISAL_STATUSES, type ScopeTab } from '../../types/performance.types'
import { formatDate, formatStamp } from '../../utils/format'
import { writablePart } from '../../utils/scores'
import {
  navyButtonClass,
  outlineButtonClass,
  tableClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { FiltersDialog } from '../shared/dialogs'
import { Chip, FilterButton, PageHeaderCard, ScopeTabsBar, SearchBox } from '../shared/parts'
import { ReviewView } from './review-form'

const routeApi = getRouteApi('/_app/performance/reviews')

const TITLES: Record<ScopeTab, string> = {
  my: 'My Self Reviews',
  team: 'Reviews I Write as Manager',
  all: 'All Reviews',
}

type ReviewFilters = Pick<ReviewsSearch, 'cycleId' | 'status'>

function ReviewFiltersDialog({
  value,
  onApply,
  onClose,
}: {
  value: ReviewFilters
  onApply: (filters: ReviewFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const cycles = useCycleOptions()
  return (
    <FiltersDialog
      onApply={() => {
        onApply(draft)
      }}
      onReset={() => {
        onApply({ cycleId: undefined, status: undefined })
      }}
      onClose={onClose}
    >
      <FormField label="Review Cycle">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.cycleId ?? null}
            onChange={(next) => {
              setDraft((current) => ({ ...current, cycleId: next ?? undefined }))
            }}
            options={(cycles.data?.data ?? []).map((cycle) => ({
              value: cycle.id,
              label: cycle.name,
            }))}
            placeholder="All Cycles"
            clearable
          />
        )}
      </FormField>
      <FormField label="Status">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.status ?? null}
            onChange={(next) => {
              setDraft((current) => ({
                ...current,
                status: APPRAISAL_STATUSES.find((status) => status === next),
              }))
            }}
            options={APPRAISAL_STATUSES.filter((status) => status !== 'draft').map((status) => ({
              value: status,
              label: APPRAISAL_STATUS_META[status].label,
            }))}
            placeholder="All Statuses"
            clearable
          />
        )}
      </FormField>
    </FiltersDialog>
  )
}

/** What the signed-in person's part is in a review, in words. */
function partText(
  row: Appraisal,
  myId: string | null,
  rights: Record<'self' | 'manager', boolean>,
): string {
  const part = writablePart(row, myId, rights)
  if (part === 'self')
    return row.selfScore === null ? 'Self review to write' : 'Self review: draft saved'
  if (part === 'manager') {
    return row.managerScore === null ? 'Manager review to write' : 'Manager review: draft saved'
  }
  if (row.status === 'finalised') return `Finalised ${formatStamp(row.finalisedAt)}`
  if (row.status === 'reviewed') return 'Both reviews in; waiting for HR to finalise'
  if (row.status === 'manager_review') return `Waiting for ${row.reviewerName ?? 'the manager'}`
  if (row.status === 'self_review') return `Waiting for ${row.employeeName}`
  return 'Not launched'
}

/**
 * Reviews: the caller's own self reviews (My), the ones they write as a manager (Team) and, for
 * HR, every review (All); the ones waiting for the caller come first. A row opens its review in
 * place (`?review=<id>`).
 */
export function ReviewsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const myId = useMyEmployeeId()
  const rights = useReviewRights()
  const canManager = useCan(PERF_CODES.reviewsManager)
  const canAll = useCan(PERF_CODES.reviewsAll)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const tabs: ScopeTab[] = [
    'my',
    ...(canManager ? (['team'] as const) : []),
    ...(canAll ? (['all'] as const) : []),
  ]
  const tab = tabs.includes(search.tab) ? search.tab : 'my'
  const update = (patch: Partial<ReviewsSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const list = useReviewList({
    tab,
    cycleId: search.cycleId,
    status: search.status,
    q: search.q,
    page: search.page,
    pageSize: search.pageSize,
  })
  const filters: ReviewFilters = { cycleId: search.cycleId, status: search.status }
  const filterCount = Object.values(filters).filter(Boolean).length

  if (search.review) {
    return (
      <PageContainer>
        <ReviewView
          reviewId={search.review}
          onBack={() => {
            update({ review: undefined })
          }}
        />
      </PageContainer>
    )
  }

  const columns: DataTableColumn<Appraisal>[] = [
    ...(tab === 'my'
      ? []
      : [
          {
            id: 'employee',
            header: 'Employee',
            mobile: 'heading' as const,
            className: 'min-w-40 whitespace-normal',
            cell: (row: Appraisal) => (
              <span className="grid gap-0.5">
                <span className="font-medium">{row.employeeName}</span>
                <span className="text-[0.625rem] text-grey">
                  {[row.employeeCode, row.jobTitleName].filter(Boolean).join(' · ')}
                </span>
              </span>
            ),
          },
        ]),
    {
      id: 'cycle',
      header: 'Review Cycle',
      ...(tab === 'my' ? { mobile: 'heading' as const } : {}),
      className: 'min-w-40 whitespace-normal',
      cell: (row) => row.cycleName,
    },
    {
      id: 'due',
      header: 'Due',
      cell: (row) =>
        formatDate(row.status === 'self_review' ? row.selfReviewDueDate : row.managerReviewDueDate),
    },
    {
      id: 'part',
      header: 'Your Part',
      className: 'min-w-44 whitespace-normal',
      cell: (row) => partText(row, myId, rights),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={appraisalStatusMeta(row)} />,
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-36',
      cell: (row) => {
        const part = writablePart(row, myId, rights)
        const started = part === 'self' ? row.selfScore !== null : row.managerScore !== null
        return (
          <Button
            type="button"
            onClick={() => {
              update({ review: row.id })
            }}
            aria-label={`${part ? (started ? 'Continue' : 'Start') : 'View'} the review of ${row.employeeName} for ${row.cycleName}`}
            className={cn(
              toolbarButtonClass,
              'px-4 text-xs',
              part ? navyButtonClass : outlineButtonClass,
            )}
            variant={part ? 'default' : 'outline'}
          >
            {part ? (started ? 'Continue' : 'Start Review') : 'View'}
          </Button>
        )
      },
    },
  ]

  return (
    <PageContainer>
      <PageHeaderCard
        title="Reviews"
        description="Write your self review, then your team’s manager reviews once theirs are in."
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
              label="Whose reviews"
              onChange={(next) => {
                update({ tab: next, page: 1 })
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                key={search.q ?? ''}
                value={search.q}
                label="Search reviews"
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
            ? 'No reviews match the search or filters.'
            : tab === 'team'
              ? 'Nobody you review is in a running cycle.'
              : 'No reviews yet: they open when a review cycle you are in is launched.'
        }
      />
      {filtersOpen && (
        <ReviewFiltersDialog
          value={filters}
          onApply={(next) => {
            update({ ...next, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
    </PageContainer>
  )
}
